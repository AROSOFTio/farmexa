"""
Structural validation of the Alembic migration chain.

Guards against the class of bug where two migration files declare
overlapping/duplicate revisions or reference a non-existent down_revision,
which leaves the chain unresolvable (multiple heads / branch points) and
crashes `alembic upgrade head` on a fresh database.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]

# backend/alembic/ shadows the installed alembic package when /app is on sys.path.
_local_alembic = BACKEND_DIR / "alembic"
for path in list(sys.path):
    resolved = Path(path).resolve() if path else Path.cwd()
    if resolved == BACKEND_DIR.resolve() or resolved == _local_alembic.resolve():
        if path in sys.path:
            sys.path.remove(path)

from alembic.config import Config
from alembic.script import ScriptDirectory


def _script_directory() -> ScriptDirectory:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    return ScriptDirectory.from_config(config)


def test_migration_chain_has_single_head():
    script = _script_directory()
    heads = script.get_heads()
    assert len(heads) == 1, (
        f"Alembic revision graph has {len(heads)} heads (branch point): {heads}. "
        "Each migration's down_revision must form a single linear chain."
    )


def test_migration_chain_resolves_without_gaps():
    script = _script_directory()
    revisions = list(script.walk_revisions())
    assert revisions, "No migrations found under alembic/versions"

    known_revisions = {rev.revision for rev in revisions}
    for rev in revisions:
        if rev.down_revision is None:
            continue
        down_revisions = (
            rev.down_revision
            if isinstance(rev.down_revision, tuple)
            else (rev.down_revision,)
        )
        for down in down_revisions:
            assert down in known_revisions, (
                f"Migration {rev.revision} ({rev.path}) references unknown "
                f"down_revision '{down}'"
            )


def test_no_duplicate_revision_ids():
    script = _script_directory()
    revisions = list(script.walk_revisions())
    revision_ids = [rev.revision for rev in revisions]
    assert len(revision_ids) == len(set(revision_ids)), (
        "Duplicate revision identifiers found in alembic/versions"
    )
