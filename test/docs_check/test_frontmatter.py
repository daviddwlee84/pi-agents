from __future__ import annotations

import pytest

from conftest import VALID_NOTE_METADATA, issues_for, rule_ids
from scripts import check_docs


def test_mkdocs_delimiters_crlf_and_semantic_mapping_equality(docs_site, note):
    english_metadata = """\
kind: product-note
status: reviewed
as_of: 2026-08-31
last_verified: 2026-08-30
upstreams: [https://example.com/one, https://example.com/two] # sources
confidence: medium-high
"""
    translated_metadata = """\
# Mapping order and notation are not semantic drift.
confidence: medium-high
upstreams:
  - https://example.com/one
  - https://example.com/two
last_verified: 2026-08-30
as_of: 2026-08-31
status: reviewed
kind: product-note
"""
    english = note(
        "# Reviewed note\n\nComplete English research prose.",
        english_metadata,
        "---   ",
        "... ",
    ).replace("\n", "\r\n")
    translation = note(
        "# 已審查筆記\n\n完整的繁體中文研究內容。",
        translated_metadata,
    )
    docs_site.write_pair(english, translation, "notes/equality.md")

    result = docs_site.check()

    assert result.pair_count == 1
    assert result.issues == ()


def test_multimarkdown_metadata_uses_mkdocs_semantics(docs_site):
    docs_site.write_pair(
        "Title: Shared\nAudience: maintainers\n\n# Page\n\nComplete English prose.\n",
        "Audience: maintainers\nTitle: Shared\n\n# 頁面\n\n完整的繁體中文內容。\n",
    )

    assert docs_site.check().issues == ()


def test_frontmatter_sequence_order_is_semantic(docs_site, note):
    english = note(
        "# Sources\n\nComplete English research prose.",
        VALID_NOTE_METADATA.replace(
            "  - https://example.com/source",
            "  - https://example.com/one\n  - https://example.com/two",
        ),
    )
    translation = note(
        "# 來源\n\n完整的繁體中文研究內容。",
        VALID_NOTE_METADATA.replace(
            "  - https://example.com/source",
            "  - https://example.com/two\n  - https://example.com/one",
        ),
    )
    docs_site.write_pair(english, translation, "notes/order.md")

    result = docs_site.check()

    assert "frontmatter/mismatch" in rule_ids(result)


@pytest.mark.parametrize(
    "source, rule_id",
    [
        ("---\nkey: value\n# no closer\n", "frontmatter/malformed"),
        ("---", "frontmatter/malformed"),
        ("---\n- not\n- a mapping\n---\n# Page\n", "frontmatter/nonmapping"),
        ("---\nkey: !project-tag value\n---\n# Page\n", "frontmatter/unknown-tag"),
        ("---\nkey: !!binary SGVsbG8=\n---\n# Page\n", "frontmatter/invalid-type"),
    ],
)
def test_rejects_malformed_or_unsafe_frontmatter_roots(docs_site, source, rule_id):
    docs_site.write_pair(source, source.replace("# Page", "# 頁面"))

    result = docs_site.check()

    assert rule_id in rule_ids(result)


def test_rejects_duplicate_keys(docs_site):
    source = "---\nkind: first\nkind: second\n---\n# Page\n"
    docs_site.write_pair(source, source.replace("# Page", "# 頁面"))

    result = docs_site.check()

    duplicate = issues_for(result, "frontmatter/duplicate-key")
    assert duplicate
    assert duplicate[0].source_line == 3


def test_rejects_recursive_aliases(docs_site):
    source = "---\npayload: &payload [*payload]\n---\n# Page\n"
    docs_site.write_pair(source, source.replace("# Page", "# 頁面"))

    assert "frontmatter/recursive-alias" in rule_ids(docs_site.check())


def test_rejects_excessive_aliases(docs_site):
    aliases = ", ".join("*item" for _ in range(65))
    source = f"---\nitem: &item value\npayload: [{aliases}]\n---\n# Page\n"
    docs_site.write_pair(source, source.replace("# Page", "# 頁面"))

    assert "frontmatter/alias-limit" in rule_ids(docs_site.check())


def test_rejects_excessive_yaml_depth(docs_site):
    source = f"---\npayload: {'[' * 40}value{']' * 40}\n---\n# Page\n"
    docs_site.write_pair(source, source.replace("# Page", "# 頁面"))

    assert "frontmatter/depth-limit" in rule_ids(docs_site.check())


def test_rejects_excessive_yaml_nodes_before_source_line_limit(docs_site):
    values = ",".join("value" for _ in range(check_docs.MAX_YAML_NODES))
    source = f"---\npayload: [{values}]\n---\n# Page\n"
    assert len(source.splitlines()) < check_docs.MAX_SOURCE_LINES
    assert len(source.encode("utf-8")) < check_docs.MAX_FRONTMATTER_BYTES
    docs_site.write_pair(source, source.replace("# Page", "# 頁面"))

    rules = rule_ids(docs_site.check())

    assert "frontmatter/node-limit" in rules
    assert "page/line-limit" not in rules


def test_rejects_oversized_frontmatter(docs_site):
    source = f"---\npayload: {'x' * 66_000}\n---\n# Page\n"
    docs_site.write_pair(source, source.replace("# Page", "# 頁面"))

    assert "frontmatter/too-large" in rule_ids(docs_site.check())


def test_valid_unquoted_dates_remain_strings(docs_site, note):
    docs_site.write_pair(
        note("# Note\n\nComplete English research prose."),
        note("# 筆記\n\n完整的繁體中文研究內容。"),
        "notes/date.md",
    )

    result = docs_site.check()

    assert not ({"metadata/date", "metadata/invalid-string"} & rule_ids(result))


def test_notes_require_yaml_not_multimarkdown_metadata(docs_site):
    metadata = VALID_NOTE_METADATA.replace("\n", "\n").rstrip()
    docs_site.write_pair(
        f"{metadata}\n\n# Note\n\nComplete English research prose.\n",
        f"{metadata}\n\n# 筆記\n\n完整的繁體中文研究內容。\n",
        "notes/no-yaml.md",
    )

    assert "metadata/missing-frontmatter" in rule_ids(docs_site.check())


def test_notes_report_missing_required_keys(docs_site, note):
    metadata = "status: reviewed\n"
    docs_site.write_pair(
        note("# Note\n\nComplete English research prose.", metadata),
        note("# 筆記\n\n完整的繁體中文研究內容。", metadata),
        "notes/missing.md",
    )

    result = docs_site.check()

    assert len(issues_for(result, "metadata/missing-key")) == 5


def test_notes_reject_wrong_scalar_types_status_and_calendar_dates(docs_site, note):
    metadata = """\
kind: true
status: draft
as_of: 2026-02-30
last_verified: 42
upstreams: [https://example.com/source]
confidence: {level: high}
"""
    docs_site.write_pair(
        note("# Note\n\nComplete English research prose.", metadata),
        note("# 筆記\n\n完整的繁體中文研究內容。", metadata),
        "notes/types.md",
    )

    rules = rule_ids(docs_site.check())

    assert {"metadata/invalid-string", "metadata/status", "metadata/date"} <= rules


@pytest.mark.parametrize(
    "upstreams, rule_id",
    [
        ("[]", "metadata/upstreams"),
        ("https://example.com/not-a-list", "metadata/upstreams"),
        ("[ftp://example.com/source]", "metadata/url"),
        ("[https://]", "metadata/url"),
        ("[42]", "metadata/url"),
        ("['https://example.com/a b']", "metadata/url"),
        ("[https://%zz]", "metadata/url"),
        (r"[https://example.com\@evil.test/path]", "metadata/url"),
        ("[https://example.com:]", "metadata/url"),
    ],
)
def test_notes_require_nonempty_http_urls(docs_site, note, upstreams, rule_id):
    metadata = VALID_NOTE_METADATA.replace(
        "upstreams:\n  - https://example.com/source", f"upstreams: {upstreams}"
    )
    docs_site.write_pair(
        note("# Note\n\nComplete English research prose.", metadata),
        note("# 筆記\n\n完整的繁體中文研究內容。", metadata),
        "notes/urls.md",
    )

    assert rule_id in rule_ids(docs_site.check())


def test_notes_accept_assigned_unicode_in_http_url(docs_site, note):
    metadata = VALID_NOTE_METADATA.replace(
        "https://example.com/source",
        "https://example.com/資料?q=résumé",
    )
    docs_site.write_pair(
        note("# Note\n\nComplete English research prose.", metadata),
        note("# 筆記\n\n完整的繁體中文研究內容。", metadata),
        "notes/unicode-url.md",
    )

    assert docs_site.check().issues == ()


@pytest.mark.parametrize(
    "escaped_url",
    [
        r"https://example.com/\0nul",
        r"https://example.com/\abel",
        r"https://example.com/\eescape",
        r"https://example.com/\x7fdel",
        r"https://example.com/\tspace",
        r"https://example.com/ space",
        r"https://example.com/​format",
        r"https://example.com/\ud800surrogate",
        r"https://example.com/private",
        r"https://example.com/͸unassigned",
    ],
)
def test_notes_reject_yaml_decoded_prohibited_url_characters(
    docs_site, note, escaped_url
):
    metadata = VALID_NOTE_METADATA.replace(
        "upstreams:\n  - https://example.com/source",
        f'upstreams:\n  - "{escaped_url}"',
    )
    docs_site.write_pair(
        note("# Note\n\nComplete English research prose.", metadata),
        note("# 筆記\n\n完整的繁體中文研究內容。", metadata),
        "notes/prohibited-url-character.md",
    )

    result = docs_site.check()

    assert [issue.rule_id for issue in result.issues] == ["metadata/url"]
    assert result.errors[0].startswith(
        "notes/prohibited-url-character.md: metadata/url:"
    )


def test_semantic_metadata_equality_preserves_yaml_types(docs_site):
    docs_site.write_pair(
        "---\nvalue: {}\nflag: true\n---\n# Page\n",
        "---\nvalue: []\nflag: 1\n---\n# 頁面\n",
    )

    assert "frontmatter/mismatch" in rule_ids(docs_site.check())


def test_bounded_nonrecursive_aliases_are_supported(docs_site):
    english = "---\nvalues: &values [one, two]\ncopy: *values\n---\n# Page\n"
    translation = english.replace("# Page", "# 頁面")
    docs_site.write_pair(english, translation)

    assert docs_site.check().issues == ()


def test_recursive_merge_alias_is_rejected_without_recursing(docs_site):
    source = "---\nvalue: &value\n  <<: *value\n---\n# Page\n"
    docs_site.write_pair(source, source.replace("# Page", "# 頁面"))

    assert "frontmatter/recursive-alias" in rule_ids(docs_site.check())


def test_yaml_merge_expansion_is_rejected_before_construction(docs_site):
    source = "---\nbase: &base {one: 1}\nvalue: {<<: *base, two: 2}\n---\n# Page\n"
    docs_site.write_pair(source, source.replace("# Page", "# 頁面"))

    assert "frontmatter/alias-limit" in rule_ids(docs_site.check())


def test_explicit_timestamp_tag_is_not_coerced_to_a_string(docs_site):
    docs_site.write_pair(
        "---\nas_of: !!timestamp 2026-08-31\n---\n# Page\n",
        '---\nas_of: "2026-08-31"\n---\n# 頁面\n',
    )

    assert "frontmatter/invalid-type" in rule_ids(docs_site.check())


def test_utf8_bom_matches_mkdocs_source_decoding(docs_site, note):
    english = note("# Note\n\nComplete English research prose.")
    translation = note("# 筆記\n\n完整的繁體中文研究內容。")
    english_path = docs_site.root / "notes" / "bom.md"
    translation_path = docs_site.root / "notes" / "bom.zh-TW.md"
    english_path.parent.mkdir(parents=True)
    english_path.write_bytes(b"\xef\xbb\xbf" + english.encode("utf-8"))
    translation_path.write_bytes(b"\xef\xbb\xbf" + translation.encode("utf-8"))

    assert docs_site.check().issues == ()


def test_yaml_reader_failure_from_nul_is_a_deterministic_issue(docs_site):
    source = "---\nkey: bad\x00value\n---\n# Page\n"
    docs_site.write_pair(source, source.replace("# Page", "# 頁面"))

    assert "frontmatter/invalid-yaml" in rule_ids(docs_site.check())


def test_yaml_loader_constructor_exceptions_are_bounded(docs_site, monkeypatch):
    source = "---\nkey: value\n---\n# Page\n"
    docs_site.write_pair(source, source.replace("# Page", "# 頁面"))

    def fail_loader(_source):
        raise RuntimeError("constructor failed")

    monkeypatch.setattr(check_docs, "BoundedSafeLoader", fail_loader)

    assert "frontmatter/invalid-yaml" in rule_ids(docs_site.check())


def test_multimarkdown_metadata_is_bounded_before_mkdocs_parse(
    docs_site, monkeypatch
):
    source = "One: 1\nTwo: 2\nThree: 3\n\n# Page\n"
    docs_site.write_pair(source, source.replace("# Page", "# 頁面"))
    called = False
    original = check_docs.mkdocs_meta.get_data

    def track_get_data(value):
        nonlocal called
        called = True
        return original(value)

    monkeypatch.setattr(check_docs, "MAX_METADATA_LINES", 2)
    monkeypatch.setattr(check_docs.mkdocs_meta, "get_data", track_get_data)

    result = docs_site.check()

    assert "frontmatter/node-limit" in rule_ids(result)
    assert called is False
