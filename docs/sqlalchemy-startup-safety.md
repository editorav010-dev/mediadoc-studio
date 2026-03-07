SQLAlchemy Startup Safety
=========================

This project intentionally avoids any destructive database behavior on startup.
If and when we introduce SQLAlchemy for the FastAPI backend (`packages/backend`),
**we must never drop all tables automatically when the server reloads.**

Why `drop_all()` is dangerous
-----------------------------

- `Base.metadata.drop_all(bind=engine)` (or its async equivalent) will **delete every table**
  in the database.
- If this runs on every reload (for example, in a `@app.on_event("startup")` handler),
  all data will disappear:
  - users
  - classes
  - marks
  - any other persisted records

This is acceptable only in a **one-off, explicit dev script**, never in the normal
application startup path.

Correct startup pattern
-----------------------

When wiring SQLAlchemy into the FastAPI backend, the startup logic must **only create
tables if they do not exist**, using `create_all` and **never** `drop_all`.

### Async engine (FastAPI typical pattern)

```python
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncEngine

from .db import async_engine, Base

app = FastAPI()


@app.on_event("startup")
async def on_startup() -> None:
    """Create tables if they do not exist. Do NOT drop anything."""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

### Sync engine

```python
from .db import engine, Base

def init_db() -> None:
    """Create tables if they do not exist. Do NOT drop anything."""
    Base.metadata.create_all(bind=engine)
```

Where to put this in the codebase
---------------------------------

When the backend is implemented under `packages/backend`, follow this structure:

- `packages/backend/app/db.py`
  - defines `engine` / `async_engine` and `Base`
  - central place for configuring SQLAlchemy (URL, echo, pool sizing, etc.)
- `packages/backend/app/main.py`
  - defines `FastAPI` app
  - registers the startup handler that calls **only** `Base.metadata.create_all`
    (or triggers migrations)

Destructive operations policy
-----------------------------

- **Never** call `Base.metadata.drop_all(...)` in:
  - `@app.on_event("startup")` handlers
  - reload hooks
  - shared utility modules that run on import
- If a full schema reset is ever needed for development:
  - implement a separate, explicit script (for example, `scripts/reset_db.py`)
  - or use a migration tool (Alembic) with a clear, manual command
  - document clearly that running it will **destroy all data**

Current repository status
-------------------------

As of this document:

- There is **no** `main.py` entrypoint in the repository.
- There are **no** usages of `Base.metadata.drop_all` or `Base.metadata.create_all`.
- The backend database bootstrap has **not yet been implemented**, and this document
  defines the required safe pattern for when it is added.

