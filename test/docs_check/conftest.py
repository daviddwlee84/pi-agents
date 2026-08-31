from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts import check_docs  # noqa: E402

CONFIG_PATH = REPO_ROOT / "mkdocs.yml"

VALID_NOTE_METADATA = """\
kind: product-note
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-31
upstreams:
  - https://example.com/source
confidence: high
"""


@dataclass
class DocsSite:
    root: Path

    def write(self, relative_path: str, source: str) -> Path:
        path = self.root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(source, encoding="utf-8")
        return path

    def write_pair(
        self,
        english: str,
        translation: str,
        relative_path: str = "page.md",
    ) -> tuple[Path, Path]:
        translated_path = relative_path.removesuffix(".md") + ".zh-TW.md"
        return self.write(relative_path, english), self.write(translated_path, translation)

    def check(self) -> check_docs.CheckResult:
        return check_docs.validate_documentation_root(
            self.root,
            config_path=CONFIG_PATH,
        )


@pytest.fixture
def docs_site(tmp_path: Path) -> DocsSite:
    return DocsSite(tmp_path / "docs")


@pytest.fixture
def note() -> Callable[[str, str, str, str], str]:
    def make_note(
        body: str,
        metadata: str = VALID_NOTE_METADATA,
        opener: str = "---",
        closer: str = "---",
    ) -> str:
        return f"{opener}\n{metadata.rstrip()}\n{closer}\n\n{body.strip()}\n"

    return make_note


def rule_ids(result: check_docs.CheckResult) -> set[str]:
    return {issue.rule_id for issue in result.issues}


def issues_for(result: check_docs.CheckResult, rule_id: str) -> list[check_docs.Issue]:
    return [issue for issue in result.issues if issue.rule_id == rule_id]
