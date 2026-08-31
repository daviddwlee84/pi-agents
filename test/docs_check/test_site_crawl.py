from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

from conftest import REPO_ROOT, rule_ids
from scripts import check_docs


SITE_ORIGIN = "https://daviddwlee84.github.io"
SITE_HOST = "daviddwlee84.github.io"
SITE_PREFIX = "/pi-agents/"


def write_site_file(root: Path, relative: str, content: str | bytes = b"") -> Path:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(content, bytes):
        path.write_bytes(content)
    else:
        path.write_text(content, encoding="utf-8")
    return path


def test_site_crawl_accepts_all_local_attributes_fragments_and_external_urls(
    tmp_path
):
    site = tmp_path / "site"
    write_site_file(
        site,
        "index.html",
        f"""<!doctype html>
<link rel="canonical" href="{SITE_ORIGIN}{SITE_PREFIX}">
<link rel="stylesheet" href="{SITE_PREFIX}assets/style.css">
<div id="home"></div>
<a href="{SITE_ORIGIN}{SITE_PREFIX}guide/#topic">Guide</a>
<a href="?mode=compact#home">Same page</a>
<a href="https://example.net/elsewhere">External</a>
<a href="//cdn.example.net/file.js">Network path</a>
<a href="mailto:docs@example.net">Mail</a>
<a href="data:text/plain,inline">Data link</a>
<img src="//{SITE_HOST}{SITE_PREFIX}assets/image.png" srcset="assets/image.png 1x, data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA 2x">
<video poster="assets/poster.jpg"><source src="assets/video.mp4"></video>
<form action="guide/?submit=1"><button formaction="#home">Submit</button></form>
<blockquote cite="guide/">Quote</blockquote>
<object data="assets/object.bin"></object>
<script src="assets/app.js"></script>
""",
    )
    write_site_file(site, "guide/index.html", '<h1 id="topic">Topic</h1>')
    for asset in (
        "style.css",
        "image.png",
        "poster.jpg",
        "video.mp4",
        "object.bin",
        "app.js",
    ):
        write_site_file(site, f"assets/{asset}")

    result = check_docs.validate_built_site(site)

    assert result.html_file_count == 2
    assert result.issues == ()


@pytest.mark.parametrize(
    ("attribute", "element"),
    [
        ("href", '<a href="missing.html">Missing</a>'),
        ("src", '<script src="missing.js"></script>'),
        ("srcset", '<img srcset="missing.png 1x">'),
        ("poster", '<video poster="missing.jpg"></video>'),
        ("action", '<form action="missing/"></form>'),
        ("formaction", '<button formaction="missing/">Go</button>'),
        ("cite", '<blockquote cite="missing.html">Quote</blockquote>'),
        ("data", '<object data="missing.bin"></object>'),
    ],
)
def test_site_crawl_checks_every_local_url_attribute(tmp_path, attribute, element):
    site = tmp_path / "site"
    write_site_file(site, "index.html", element)

    result = check_docs.validate_built_site(site)

    missing = [issue for issue in result.issues if issue.rule_id == "site/target-missing"]
    assert missing
    assert attribute in missing[0].message


@pytest.mark.parametrize(
    "href",
    [
        f"{SITE_PREFIX}missing/",
        f"{SITE_ORIGIN}{SITE_PREFIX}missing/",
        f"//{SITE_HOST}{SITE_PREFIX}missing/",
    ],
)
def test_site_crawl_checks_same_origin_and_prefixed_root_urls(tmp_path, href):
    site = tmp_path / "site"
    write_site_file(site, "index.html", f'<a href="{href}">Missing</a>')

    result = check_docs.validate_built_site(site)

    assert "site/target-missing" in rule_ids(result)


@pytest.mark.parametrize("duplicate_id", ["same", ""])
def test_site_crawl_rejects_duplicate_ids(tmp_path, duplicate_id):
    site = tmp_path / "site"
    write_site_file(
        site,
        "index.html",
        f'<div id="{duplicate_id}"></div><span id="{duplicate_id}"></span>',
    )

    result = check_docs.validate_built_site(site)

    assert "site/duplicate-id" in rule_ids(result)


@pytest.mark.parametrize(
    "href",
    ["#missing", "guide/#missing", "guide/index.html#missing"],
)
def test_site_crawl_rejects_missing_local_fragments(tmp_path, href):
    site = tmp_path / "site"
    write_site_file(site, "index.html", f'<main id="home"><a href="{href}">Jump</a></main>')
    write_site_file(site, "guide/index.html", '<h1 id="present">Guide</h1>')

    result = check_docs.validate_built_site(site)

    assert "site/fragment-missing" in rule_ids(result)


@pytest.mark.parametrize(
    "href",
    ["../../../outside.html", "%2e%2e/%2e%2e/outside.html"],
)
def test_site_crawl_rejects_relative_targets_outside_root(tmp_path, href):
    site = tmp_path / "site"
    write_site_file(site, "nested/index.html", f'<a href="{href}">Outside</a>')
    write_site_file(tmp_path, "outside.html", "outside")

    result = check_docs.validate_built_site(site)

    assert "site/outside-target" in rule_ids(result)


@pytest.mark.parametrize(
    "href",
    [
        "/",
        "/other/existing/",
        f"{SITE_ORIGIN}/",
        f"{SITE_ORIGIN}/other/existing/",
        f"//{SITE_HOST}/",
        f"//{SITE_HOST}/other/existing/",
    ],
)
def test_site_crawl_rejects_same_origin_urls_outside_configured_prefix(
    tmp_path, href
):
    site = tmp_path / "site"
    write_site_file(site, "index.html", f'<a href="{href}">Outside deployment</a>')
    write_site_file(site, "other/existing/index.html", "<h1>Present on disk</h1>")

    result = check_docs.validate_built_site(site)

    assert "site/outside-target" in rule_ids(result)


def test_site_crawl_honors_local_base_href(tmp_path):
    site = tmp_path / "site"
    write_site_file(
        site,
        "index.html",
        '<base href="nested/"><a href="target/#present">Target</a>',
    )
    write_site_file(site, "nested/index.html", "<h1>Base target</h1>")
    write_site_file(site, "nested/target/index.html", '<h1 id="present">Target</h1>')

    assert check_docs.validate_built_site(site).issues == ()


@pytest.mark.parametrize(
    ("markup", "rule_id"),
    [
        ('<a href="missing/">Missing page</a>', "site/target-missing"),
        ('<img src="missing.png" alt="Missing resource">', "site/target-missing"),
        ('<a href="#missing">Missing fragment</a>', "site/fragment-missing"),
    ],
)
def test_built_crawl_catches_identical_broken_raw_local_destinations(
    tmp_path, markup, rule_id
):
    site = tmp_path / "site"
    write_site_file(site, "index.html", markup)
    write_site_file(site, "zh-TW/index.html", markup)

    result = check_docs.validate_built_site(site)
    matching = [issue for issue in result.issues if issue.rule_id == rule_id]

    assert len(matching) == 2
    assert {issue.path for issue in matching} == {"index.html", "zh-TW/index.html"}


def test_site_crawl_cli_mode_reports_success_and_failure(tmp_path):
    site = tmp_path / "site"
    page = write_site_file(site, "index.html", '<h1 id="present">Present</h1>')
    command = [
        sys.executable,
        str(REPO_ROOT / "scripts" / "check_docs.py"),
        "--site-dir",
        str(site),
    ]

    success = subprocess.run(
        command,
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert success.returncode == 0
    assert "Validated 1 built HTML file" in success.stdout
    assert success.stderr == ""

    page.write_text('<a href="missing.html">Missing</a>', encoding="utf-8")
    failure = subprocess.run(
        command,
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert failure.returncode == 1
    assert "site/target-missing" in failure.stderr


def test_site_inventory_rejects_symlinked_assets(tmp_path):
    site = tmp_path / "site"
    write_site_file(site, "index.html", "<h1>Page</h1>")
    target = write_site_file(tmp_path, "outside.js", "outside")
    link = site / "assets" / "linked.js"
    link.parent.mkdir()
    try:
        link.symlink_to(target)
    except OSError as error:
        pytest.skip(f"file symlinks are unavailable: {error}")

    assert "site/inventory-symlink" in rule_ids(check_docs.validate_built_site(site))


@pytest.mark.skipif(not hasattr(os, "mkfifo"), reason="FIFOs are unavailable")
def test_site_inventory_rejects_nonregular_entries(tmp_path):
    site = tmp_path / "site"
    write_site_file(site, "index.html", "<h1>Page</h1>")
    os.mkfifo(site / "stream")

    assert "site/inventory-nonregular-file" in rule_ids(
        check_docs.validate_built_site(site)
    )
