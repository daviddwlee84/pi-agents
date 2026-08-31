from __future__ import annotations

import io
import os
import subprocess
import sys
from pathlib import Path

import pytest

from conftest import CONFIG_PATH, REPO_ROOT, rule_ids
from scripts import check_docs


def run_cli(
    docs_root: Path,
    config_path: Path = CONFIG_PATH,
    *,
    timeout: float = 30,
):
    return subprocess.run(
        [
            sys.executable,
            str(REPO_ROOT / "scripts" / "check_docs.py"),
            "--config-file",
            str(config_path),
            "--docs-dir",
            str(docs_root),
        ],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def test_module_and_help_state_the_bounded_non_guarantee():
    assert "bounded rendered structural/lexical" in (check_docs.__doc__ or "")
    assert "metadata/source-policy" in (check_docs.__doc__ or "")
    assert "DOES NOT prove" in (check_docs.__doc__ or "")
    assert "translation meaning" in (check_docs.__doc__ or "")
    assert "completeness" in (check_docs.__doc__ or "")
    assert "factual equivalence" in (check_docs.__doc__ or "")
    assert "same-shaped translated prose identity or" in (check_docs.__doc__ or "")
    assert "arbitrary browser CSS/JS behavior" in (check_docs.__doc__ or "")
    assert "Page.render" in (check_docs.__doc__ or "")
    assert "destination canonicalization" in (check_docs.__doc__ or "")
    assert "mkdocs build --strict" in (check_docs.__doc__ or "")
    assert "DoS/resource bounds" in (check_docs.__doc__ or "")

    process = subprocess.run(
        [sys.executable, str(REPO_ROOT / "scripts" / "check_docs.py"), "--help"],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )

    assert process.returncode == 0
    for phrase in (
        "bounded rendered structural/lexical",
        "metadata/source-policy",
        "DOES NOT prove translation meaning",
        "completeness",
        "factual equivalence",
        "same-shaped translated prose identity/order",
        "arbitrary browser CSS/JS behavior",
        "full MkDocs Page.render equivalence",
        "Source destination canonicalization",
        "mkdocs build --strict",
        "DoS/resource bounds",
    ):
        assert phrase in process.stdout


def test_cli_success_reports_derived_pair_count_and_exit_zero(docs_site):
    docs_site.write_pair(
        "# Complete\n\nComplete English publication prose.\n",
        "# 完整\n\n完整的繁體中文出版內容。\n",
    )

    process = run_cli(docs_site.root)

    assert process.returncode == 0
    assert "Validated 1 documentation locale pair" in process.stdout
    assert "DOES NOT prove" in process.stdout
    assert process.stderr == ""


def test_cli_failure_reports_stable_rule_id_and_exit_one(docs_site):
    docs_site.write_pair(
        "# Complete\n\nComplete English publication prose.\n",
        "# 狀態\n\nTODO\n",
    )

    process = run_cli(docs_site.root)

    assert process.returncode == 1
    assert "Checked 1 complete documentation locale pair" in process.stdout
    assert "policy/todo" in process.stderr
    assert "Documentation validation failed" in process.stderr


def _directory_symlink_or_skip(link: Path, target: str | Path) -> None:
    try:
        link.symlink_to(target, target_is_directory=True)
    except (NotImplementedError, OSError) as error:
        pytest.skip(f"directory symlinks are unavailable: {error}")


def test_cli_rejects_directory_symlink_cycles_within_timeout(docs_site):
    docs_site.write_pair(
        "# Complete\n\nComplete English publication prose.\n",
        "# 完整\n\n完整的繁體中文出版內容。\n",
    )
    _directory_symlink_or_skip(docs_site.root / "a", ".")
    _directory_symlink_or_skip(docs_site.root / "b", ".")

    process = run_cli(docs_site.root, timeout=30)

    assert process.returncode == 1
    assert "inventory/symlink" in process.stderr


def test_cli_rejects_acyclic_file_symlink_to_external_static_content(
    docs_site, tmp_path
):
    docs_site.write_pair("# Complete\n", "# 完整\n")
    target = tmp_path / "outside.bin"
    target.write_bytes(b"outside")
    link = docs_site.root / "assets" / "linked.bin"
    link.parent.mkdir()
    try:
        link.symlink_to(target)
    except (NotImplementedError, OSError) as error:
        pytest.skip(f"file symlinks are unavailable: {error}")

    process = run_cli(docs_site.root, timeout=30)

    assert process.returncode == 1
    assert "inventory/symlink" in process.stderr


def test_cli_rejects_one_acyclic_directory_symlink(docs_site, tmp_path):
    docs_site.root.mkdir(parents=True)
    external = tmp_path / "external"
    external.mkdir()
    (external / "outside.bin").write_bytes(b"outside")
    _directory_symlink_or_skip(docs_site.root / "linked", external)

    process = run_cli(docs_site.root, timeout=30)

    assert process.returncode == 1
    assert "inventory/symlink" in process.stderr


def test_cli_rejects_symlinked_documentation_root(tmp_path):
    real_docs = tmp_path / "real-docs"
    real_docs.mkdir()
    (real_docs / "page.md").write_text("# Page\n", encoding="utf-8")
    (real_docs / "page.zh-TW.md").write_text("# 頁面\n", encoding="utf-8")
    linked_docs = tmp_path / "linked-docs"
    _directory_symlink_or_skip(linked_docs, real_docs)

    process = run_cli(linked_docs, timeout=30)

    assert process.returncode == 1
    assert "inventory/symlink" in process.stderr


def test_function_output_and_issue_order_are_deterministic(docs_site):
    docs_site.write_pair(
        "# Zed\n\nComplete English prose.\n",
        "# Zed\n\nTODO\n",
        "z.md",
    )
    docs_site.write_pair(
        "# Alpha\n\nComplete English prose.\n",
        "# Alpha\n\nTranslation pending\n",
        "a.md",
    )

    first_out, first_err = io.StringIO(), io.StringIO()
    second_out, second_err = io.StringIO(), io.StringIO()
    first_code = check_docs.run_documentation_check(
        docs_site.root,
        config_path=CONFIG_PATH,
        stdout=first_out,
        stderr=first_err,
    )
    second_code = check_docs.run_documentation_check(
        docs_site.root,
        config_path=CONFIG_PATH,
        stdout=second_out,
        stderr=second_err,
    )

    assert first_code == second_code == 1
    assert first_out.getvalue() == second_out.getvalue()
    assert first_err.getvalue() == second_err.getvalue()
    lines = [line for line in first_err.getvalue().splitlines() if line.startswith("- ")]
    assert lines == sorted(lines, key=lambda line: line.split(":", 1)[0])


def test_diagnostics_escape_path_and_excerpt_controls(docs_site):
    docs_site.write("bad\nname.md", "# Page\n")
    path_out, path_err = io.StringIO(), io.StringIO()

    check_docs.run_documentation_check(
        docs_site.root,
        config_path=CONFIG_PATH,
        stdout=path_out,
        stderr=path_err,
    )

    assert "bad\nname.md" not in path_err.getvalue()
    assert r"bad\nname.md" in path_err.getvalue()

    docs_site.write("bad separator.md", "# Page\n")
    separator_out, separator_err = io.StringIO(), io.StringIO()
    check_docs.run_documentation_check(
        docs_site.root,
        config_path=CONFIG_PATH,
        stdout=separator_out,
        stderr=separator_err,
    )
    assert " " not in separator_err.getvalue()
    assert chr(92) + "u2028" in separator_err.getvalue()

    docs_site.write_pair(
        '# Policy\n\n<a data-source="\x1b.specstory/raw">English</a>\n',
        '# 政策\n\n<a data-source="\x1b.specstory/raw">中文</a>\n',
        "safe.md",
    )
    excerpt_out, excerpt_err = io.StringIO(), io.StringIO()
    check_docs.run_documentation_check(
        docs_site.root,
        config_path=CONFIG_PATH,
        stdout=excerpt_out,
        stderr=excerpt_err,
    )

    assert "\x1b" not in excerpt_err.getvalue()
    assert r"\x1b.specstory/raw" in excerpt_err.getvalue()


@pytest.mark.skipif(not hasattr(os, "mkfifo"), reason="FIFOs are unavailable")
def test_cli_rejects_fifo_source_without_blocking(docs_site):
    docs_site.root.mkdir(parents=True)
    docs_site.write("page.zh-TW.md", "# 頁面\n")
    os.mkfifo(docs_site.root / "page.md")

    process = run_cli(docs_site.root, timeout=30)

    assert process.returncode == 1
    assert "inventory/nonregular-file" in process.stderr


def _write_modified_config(tmp_path: Path, transform) -> Path:
    source = CONFIG_PATH.read_text(encoding="utf-8")
    modified = transform(source)
    assert modified != source
    (tmp_path / "docs").mkdir()
    path = tmp_path / "mkdocs.yml"
    path.write_text(modified, encoding="utf-8")
    return path


def test_non_suffix_i18n_layout_fails_closed(tmp_path):
    config = _write_modified_config(
        tmp_path,
        lambda source: source.replace("docs_structure: suffix", "docs_structure: folder"),
    )

    profile, issues = check_docs.load_renderer_profile(config)

    assert profile is None
    assert "config/unsupported-i18n-layout" in {issue.rule_id for issue in issues}


@pytest.mark.parametrize(
    "transform",
    [
        lambda source: source.replace("  - def_list\n", "  - sane_lists\n"),
        lambda source: source.replace("anchor_linenums: true", "anchor_linenums: false"),
        lambda source: source.replace("locale: zh-TW", "locale: fr"),
        lambda source: source.replace(
            "          name: 繁體中文\n",
            "          name: 繁體中文\n"
            "          admonition_translations:\n"
            "            note: Translation pending\n",
        ),
        lambda source: source.replace(
            "          name: 繁體中文\n",
            "          name: 繁體中文\n"
            "          admonition_translations:\n"
            "            note: 2026-08-31\n",
        ),
        lambda source: source.replace(
            "          name: 繁體中文\n",
            "          name: 繁體中文\n"
            "          admonition_translations:\n"
            "            note: !!binary SGVsbG8=\n",
        ),
    ],
)
def test_renderer_extension_option_and_locale_drift_fail_closed(tmp_path, transform):
    config = _write_modified_config(tmp_path, transform)

    profile, issues = check_docs.load_renderer_profile(config)

    assert profile is None
    assert "config/unsupported-renderer-profile" in {issue.rule_id for issue in issues}


def test_renderer_profile_freeze_exceptions_become_issues(monkeypatch):
    def fail_freeze(_value):
        raise RuntimeError("freeze failed\nwith control")

    monkeypatch.setattr(check_docs, "_freeze_config", fail_freeze)

    profile, issues = check_docs.load_renderer_profile(CONFIG_PATH)

    assert profile is None
    assert "config/unsupported-renderer-profile" in {
        issue.rule_id for issue in issues
    }
    assert all("\n" not in issue.message for issue in issues)


def test_missing_config_is_a_bounded_issue(tmp_path):
    result = check_docs.validate_documentation_root(
        tmp_path / "docs",
        config_path=tmp_path / "missing.yml",
    )

    assert result.pair_count == 0
    assert rule_ids(result) == {"config/load-failed"}
