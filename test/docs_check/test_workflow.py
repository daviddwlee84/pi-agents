from __future__ import annotations

import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DOCS_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "docs.yml"


def test_docs_workflow_dispatch_concurrency_is_ref_scoped() -> None:
    workflow = DOCS_WORKFLOW.read_text(encoding="utf-8")

    assert "workflow_dispatch:" in workflow
    group_match = re.search(r"(?m)^  group:\s*(.+)$", workflow)
    assert group_match is not None
    assert group_match.group(1) == (
        "${{ github.event_name == 'pull_request' && "
        "format('docs-pr-{0}', github.event.pull_request.number) || "
        "format('docs-{0}', github.ref) }}"
    )
