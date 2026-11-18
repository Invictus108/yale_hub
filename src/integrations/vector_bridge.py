"""Hybrid search over the existing Yale text-chunk index.

The archive is embeddings_with_text_v5.npz: float32 BGE vectors in
`embeddings` and chunk strings in `texts`. Dense queries still use the
prefix from backend/rag.py ("Query: {text}"), L2-normalized, scored by
dot product.

Each query also runs BM25 over the same chunks. Reciprocal rank fusion
(k=60) merges the two lists, then BAAI/bge-reranker-v2-m3 reorders the
pool. That is the usual local stack in 2026: lexical recall for exact
names, dense recall for paraphrases, a cross-encoder for the final order.

Stdin/stdout protocol, one JSON object per line. Logs go to stderr.

  -> {"query": "machine learning at yale", "k": 5}
  <- {"chunks": [{"text": "...", "score": 0.91}]}

`python vector_bridge.py --check` confirms the archive and does not load models.
"""

from __future__ import annotations

import json
import math
import os
import re
import sys
from collections import defaultdict

DENSE_MODEL = "BAAI/bge-large-en-v1.5"
RERANK_MODEL = os.environ.get("YALE_RERANKER", "").strip() or "BAAI/bge-reranker-v2-m3"
POOL = 40
RERANK_POOL = 20
RRF_K = 60
BM25_K1 = 1.5
BM25_B = 0.75
TOKEN = re.compile(r"[a-z0-9]+")
STOP = frozenset(
    """
    a an the of to and or in on for with from by at as is are was were be been being
    it this that these those into over under about than then so if not no nor but
    what which who whom whose when where why how do does did doing done have has had
    i you we they he she them me my your our their
    """.split()
)


def embeddings_path() -> str:
    env = os.environ.get("YALE_EMBEDDINGS") or os.environ.get("RAG_EMBEDDINGS")
    if env:
        return os.path.abspath(env)
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(
        os.path.join(here, "..", "..", "..", "AI_girlfriend", "backend", "embeddings_with_text_v5.npz")
    )


def check() -> int:
    path = embeddings_path()
    if not os.path.exists(path):
        print(json.dumps({"ok": False, "error": f"not found: {path}"}))
        return 1
    import zipfile

    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
    ok = any(name.startswith("embeddings") for name in names) and any(name.startswith("texts") for name in names)
    print(json.dumps({"ok": ok, "path": path, "entries": names[:8]}))
    return 0 if ok else 1


def respond(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def silence_stdout():
    real = sys.stdout
    sys.stdout = sys.stderr
    return real


def restore_stdout(real) -> None:
    sys.stdout = real


def tokens(text: str) -> list[str]:
    body = text
    if body.lower().startswith("passage:"):
        body = body.split(":", 1)[1]
    return [tok for tok in TOKEN.findall(body.lower()) if len(tok) > 1 and tok not in STOP]


class BM25:
    """Okapi BM25 over the chunk strings. Built once when the index loads."""

    def __init__(self, docs: list[str]) -> None:
        import numpy as np

        postings: dict[str, list[tuple[int, int]]] = defaultdict(list)
        lengths = np.zeros(len(docs), dtype=np.float32)
        for doc_id, doc in enumerate(docs):
            counts: dict[str, int] = defaultdict(int)
            for tok in tokens(doc):
                counts[tok] += 1
            lengths[doc_id] = sum(counts.values())
            for term, freq in counts.items():
                postings[term].append((doc_id, freq))
        self.postings = postings
        self.lengths = lengths
        self.avgdl = float(lengths.mean()) if len(docs) else 1.0
        total = len(docs)
        self.idf = {
            term: math.log(1.0 + (total - len(hits) + 0.5) / (len(hits) + 0.5))
            for term, hits in postings.items()
        }

    def search(self, query: str, k: int) -> list[int]:
        import numpy as np

        if not len(self.lengths):
            return []
        scores = np.zeros(len(self.lengths), dtype=np.float32)
        seen = False
        for term in set(tokens(query)):
            hits = self.postings.get(term)
            if not hits:
                continue
            seen = True
            idf = self.idf[term]
            for doc_id, freq in hits:
                denom = freq + BM25_K1 * (1.0 - BM25_B + BM25_B * self.lengths[doc_id] / self.avgdl)
                scores[doc_id] += idf * (freq * (BM25_K1 + 1.0)) / denom
        if not seen:
            return []
        k = max(1, min(k, len(scores)))
        top = np.argpartition(scores, -k)[-k:]
        top = top[np.argsort(scores[top])[::-1]]
        return [int(i) for i in top if scores[int(i)] > 0]


def rrf(rankings: list[list[int]]) -> list[int]:
    fused: dict[int, float] = defaultdict(float)
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking, start=1):
            fused[doc_id] += 1.0 / (RRF_K + rank)
    return sorted(fused, key=fused.__getitem__, reverse=True)


def load_index(path: str):
    real = silence_stdout()
    try:
        import numpy as np
        from sentence_transformers import CrossEncoder, SentenceTransformer

        if not os.path.exists(path):
            raise FileNotFoundError(f"Embeddings not found at {path}. Set YALE_EMBEDDINGS to the .npz archive.")
        data = np.load(path, allow_pickle=True)
        texts = [str(item) for item in data["texts"]]
        embeddings = data["embeddings"]
        dense = SentenceTransformer(DENSE_MODEL, device="cpu")
        lexical = BM25(texts)
        reranker = None
        try:
            reranker = CrossEncoder(RERANK_MODEL, device="cpu")
        except Exception as exc:  # noqa: BLE001 — hybrid search still runs without the reranker
            print(f"[vector-db] reranker unavailable ({exc}). Returning fused BM25 + dense results.", file=sys.stderr)
        return dense, embeddings, texts, lexical, reranker
    finally:
        restore_stdout(real)


def dense_search(model, embeddings, query: str, k: int) -> list[int]:
    import numpy as np

    k = max(1, min(k, len(embeddings)))
    real = silence_stdout()
    try:
        vector = model.encode(f"Query: {query}", normalize_embeddings=True)
        scores = embeddings @ vector
    finally:
        restore_stdout(real)
    top = np.argpartition(scores, -k)[-k:]
    top = top[np.argsort(scores[top])[::-1]]
    return [int(i) for i in top]


def rerank(reranker, query: str, texts: list[str], doc_ids: list[int]) -> list[tuple[int, float]]:
    import numpy as np

    pairs = []
    for doc_id in doc_ids:
        passage = texts[doc_id]
        if passage.lower().startswith("passage:"):
            passage = passage.split(":", 1)[1].strip()
        pairs.append((query, passage[:4000]))
    real = silence_stdout()
    try:
        raw = np.asarray(reranker.predict(pairs, show_progress_bar=False, batch_size=4), dtype=np.float64)
    finally:
        restore_stdout(real)
    if raw.min() < 0 or raw.max() > 1:
        raw = 1.0 / (1.0 + np.exp(-np.clip(raw, -20, 20)))
    order = np.argsort(raw)[::-1]
    return [(doc_ids[int(i)], float(raw[int(i)])) for i in order]


def search(dense, embeddings, texts, lexical: BM25, reranker, query: str, k: int) -> list[dict]:
    k = max(1, min(int(k), 10, len(texts)))
    dense_ids = dense_search(dense, embeddings, query, min(POOL, len(texts)))
    lexical_ids = lexical.search(query, min(POOL, len(texts)))
    fused = rrf([dense_ids, lexical_ids])[: max(k, min(RERANK_POOL, len(texts)))]
    if reranker is not None and fused:
        ranked = rerank(reranker, query, texts, fused)
    else:
        ranked = [(doc_id, 0.0) for doc_id in fused]
    return [{"text": texts[doc_id], "score": score} for doc_id, score in ranked[:k]]


def serve() -> int:
    path = embeddings_path()
    loaded = None
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
            query = str(request.get("query") or "").strip()
            if not query:
                respond({"error": "query is required"})
                continue
            if loaded is None:
                loaded = load_index(path)
            respond({"chunks": search(*loaded, query, int(request.get("k") or 5))})
        except Exception as exc:  # noqa: BLE001 — one bad line must not kill the worker
            respond({"error": str(exc)})
    return 0


def query_once(query: str, k: int) -> int:
    loaded = load_index(embeddings_path())
    respond({"chunks": search(*loaded, query, k)})
    return 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--check":
        sys.exit(check())
    if len(sys.argv) > 1 and sys.argv[1] == "--query":
        text = sys.argv[2] if len(sys.argv) > 2 else ""
        take = int(sys.argv[3]) if len(sys.argv) > 3 else 3
        sys.exit(query_once(text, take))
    try:
        sys.stdin.reconfigure(encoding="utf-8")
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    sys.exit(serve())
