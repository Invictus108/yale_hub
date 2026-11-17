"""Query the existing Yale text-chunk index.

The index is the numpy archive built by AI_girlfriend
(embeddings_with_text_v5.npz): float32 BGE vectors in `embeddings` and the
chunk strings in `texts`. Query vectors use the same prefix as backend/rag.py:
"Query: {text}", L2-normalized, scored by dot product.

Stdin/stdout protocol, one JSON object per line. Logs go to stderr so they
cannot corrupt the protocol.

  -> {"query": "machine learning at yale", "k": 5}
  <- {"chunks": [{"text": "...", "score": 0.41}]}

`python vector_bridge.py --check` confirms the archive is readable and does
not load the embedding model.
"""

from __future__ import annotations

import json
import os
import sys

MODEL_NAME = "BAAI/bge-large-en-v1.5"


def embeddings_path() -> str:
    env = os.environ.get("YALE_EMBEDDINGS") or os.environ.get("RAG_EMBEDDINGS")
    if env:
        return os.path.abspath(env)
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(
        os.path.join(
            here,
            "..",
            "..",
            "..",
            "AI_girlfriend",
            "backend",
            "embeddings_with_text_v5.npz",
        )
    )


def check() -> int:
    path = embeddings_path()
    if not os.path.exists(path):
        print(json.dumps({"ok": False, "error": f"not found: {path}"}))
        return 1
    import zipfile

    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
    ok = any(name.startswith("embeddings") for name in names) and any(
        name.startswith("texts") for name in names
    )
    print(json.dumps({"ok": ok, "path": path, "entries": names[:8]}))
    return 0 if ok else 1


def respond(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def load_index(path: str):
    # Library import and model load print to stdout. Hold the protocol stream
    # aside until the JSON line is ready.
    real_stdout = sys.stdout
    sys.stdout = sys.stderr
    try:
        import numpy as np
        from sentence_transformers import SentenceTransformer

        if not os.path.exists(path):
            raise FileNotFoundError(
                f"Embeddings not found at {path}. Set YALE_EMBEDDINGS to the .npz archive."
            )
        data = np.load(path, allow_pickle=True)
        model = SentenceTransformer(MODEL_NAME, device="cpu")
        return model, data["embeddings"], data["texts"]
    finally:
        sys.stdout = real_stdout


def search(model, embeddings, texts, query: str, k: int) -> list[dict]:
    import numpy as np

    k = max(1, min(int(k), len(texts)))
    real_stdout = sys.stdout
    sys.stdout = sys.stderr
    try:
        vector = model.encode(f"Query: {query}", normalize_embeddings=True)
        scores = embeddings @ vector
    finally:
        sys.stdout = real_stdout
    top = np.argpartition(scores, -k)[-k:]
    top = top[np.argsort(scores[top])[::-1]]
    return [
        {"text": str(texts[int(i)]), "score": float(scores[int(i)])}
        for i in top
    ]


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
            model, embeddings, texts = loaded
            chunks = search(model, embeddings, texts, query, int(request.get("k") or 5))
            respond({"chunks": chunks})
        except Exception as exc:  # noqa: BLE001 — one bad line must not kill the worker
            respond({"error": str(exc)})
    return 0


def query_once(query: str, k: int) -> int:
    model, embeddings, texts = load_index(embeddings_path())
    respond({"chunks": search(model, embeddings, texts, query, k)})
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
