from __future__ import annotations

import os
from pathlib import Path

import pytest

from conftest import CONFIG_PATH, REPO_ROOT, rule_ids
from scripts import check_docs


def assert_valid(result, pair_count=1):
    assert result.pair_count == pair_count
    assert result.issues == ()


def assert_rule(result, rule_id):
    assert rule_id in rule_ids(result), result.errors


def test_comments_code_raw_text_and_todo_destination_are_not_visible_placeholders(docs_site):
    english = """# Samples

<!-- Translation pending TODO -->

The literal `Translation pending TODO` is sample output.

```text
Translation pending TODO
.specstory sediment:// utm_source=chatgpt
```

    TODO in classic indented code

<code>Translation pending TODO</code>
<script>Translation pending TODO .specstory sediment://</script>
<style>.TODO { background: url("sediment://hidden"); }</style>
<template>Translation pending TODO .specstory</template>

Read [the planning file](TODO.md).
"""
    translation = """# 範例

<!-- Translation pending TODO -->

字面值 `Translation pending TODO` 是範例輸出。

```text
Translation pending TODO
.specstory sediment:// utm_source=chatgpt
```

    TODO in classic indented code

<code>Translation pending TODO</code>
<script>Translation pending TODO .specstory sediment://</script>
<style>.TODO { background: url("sediment://hidden"); }</style>
<template>Translation pending TODO .specstory</template>

請閱讀[規劃檔案](TODO.md)。
"""
    docs_site.write_pair(english, translation)

    assert_valid(docs_site.check())


@pytest.mark.parametrize(
    "placeholder, rule_id",
    [
        ("Translation **pending**", "policy/translation-pending"),
        ("Translation\npending", "policy/translation-pending"),
        ("T&#79;DO", "policy/todo"),
        ("請TODO處理", "policy/todo"),
        ("前Translation pending後", "policy/translation-pending"),
        ("[TODO](roadmap.md)", "policy/todo"),
    ],
)
def test_formatted_entities_and_link_labels_remain_visible(docs_site, placeholder, rule_id):
    docs_site.write_pair(
        "# Complete\n\nComplete English publication prose.\n",
        f"# 狀態\n\n{placeholder}\n",
    )

    assert_rule(docs_site.check(), rule_id)


@pytest.mark.parametrize(
    "source, rule_id",
    [
        ("Read [.specstory/history](safe.md).", "policy/specstory"),
        ('<a data-source="%2Especstory%2Fhistory">來源</a>', "policy/specstory"),
        ('<video data-source="sediment%3A%2F%2Fasset"></video>', "policy/sediment"),
        ('<a\n href="https://example.com/?utm_source%3Dchatgpt.com">Source</a>', "policy/chatgpt-tracking"),
        ("Visible sediment://asset reference.", "policy/sediment"),
    ],
)
def test_decoded_rendered_text_and_attributes_enforce_source_policy(
    docs_site, source, rule_id
):
    docs_site.write_pair(
        f"# Source policy\n\n{source}\n",
        f"# 來源政策\n\n{source}\n",
    )

    assert_rule(docs_site.check(), rule_id)


def test_authored_reserved_looking_classes_do_not_bypass_policy(docs_site):
    source = '<a class="headerlink" href="https://example.com/?utm_source=chatgpt">Authored link</a>'
    docs_site.write_pair(
        f"# Policy\n\n{source}\n",
        f"# 政策\n\n{source}\n",
    )

    assert_rule(docs_site.check(), "policy/chatgpt-tracking")


def test_authored_headerlink_inside_heading_is_not_generated_ui(docs_site):
    docs_site.write_pair(
        '# Heading <a class="headerlink" href="safe.md">English label</a>\n',
        '# 標題 <a class="headerlink" href=".specstory/raw.md">TODO</a>\n',
    )

    result = docs_site.check()
    assert_rule(result, "policy/specstory")
    assert_rule(result, "policy/todo")
    assert_rule(result, "pair/destination")


def test_hidden_dom_text_is_not_visible_placeholder_text(docs_site):
    docs_site.write_pair(
        "# Hidden\n\n<section hidden>Translation pending TODO</section>\n",
        "# 隱藏\n\n<section hidden>Translation pending TODO</section>\n",
    )

    assert_valid(docs_site.check())


@pytest.mark.parametrize(
    "style",
    ["display: none", "display: block; display: none", "visibility: hidden"],
)
def test_inline_style_hidden_text_is_not_visible_placeholder_text(
    docs_site, style
):
    source = f'<section style="{style}">Translation pending TODO</section>'
    docs_site.write_pair(f"# Hidden\n\n{source}\n", f"# 隱藏\n\n{source}\n")

    rules = rule_ids(docs_site.check())
    assert "policy/todo" not in rules
    assert "policy/translation-pending" not in rules


def test_visibility_visible_overrides_inherited_hidden_for_policy(docs_site):
    docs_site.write_pair(
        '# Visibility\n\n<section style="visibility:hidden"><p style="visibility:visible">Complete English prose</p></section>\n',
        '# 可見性\n\n<section style="visibility:hidden"><p style="visibility:visible">TODO</p></section>\n',
    )

    assert_rule(docs_site.check(), "policy/todo")


def test_generated_permalink_signature_with_extra_policy_attribute_is_authored(docs_site):
    source = (
        '<h2 id="section">Section<a class="headerlink" href="#section" '
        'title="Permanent link" data-source=".specstory/raw">¶</a></h2>'
    )
    docs_site.write_pair(source, source)

    assert_rule(docs_site.check(), "policy/specstory")


def test_authored_footnote_backref_lookalike_cannot_hide_policy_text(docs_site):
    source = (
        '<div class="footnote"><p><a class="footnote-backref" '
        'href=".specstory/raw" title="Jump back to footnote 1 in the text">'
        'TODO</a></p></div>'
    )
    docs_site.write_pair(source, source)

    result = docs_site.check()
    assert_rule(result, "policy/specstory")
    assert_rule(result, "policy/todo")


def test_raw_link_attributes_inside_pre_are_policy_checked_but_text_is_literal(docs_site):
    source = '<pre><a href=".specstory/raw">TODO</a></pre>'
    docs_site.write_pair(source, source)

    result = docs_site.check()
    assert_rule(result, "policy/specstory")
    assert "policy/todo" not in rule_ids(result)


def test_visible_code_filename_is_checked_for_placeholders(docs_site):
    source = '# Code\n\n```text title="TODO"\nliteral\n```\n'
    docs_site.write_pair(source, source)

    assert_rule(docs_site.check(), "policy/todo")


def test_forbidden_source_strings_inside_comments_and_literal_code_are_allowed(docs_site):
    literal = """<!-- .specstory sediment:// utm_source=chatgpt -->

`.specstory sediment:// utm_source=chatgpt`

<pre><code>.specstory sediment:// utm_source=chatgpt
</code></pre>
"""
    docs_site.write_pair(
        f"# Literal\n\n{literal}\nComplete English prose.\n",
        f"# 字面值\n\n{literal}\n完整的繁體中文內容。\n",
    )

    assert_valid(docs_site.check())


@pytest.mark.parametrize(
    "destination",
    [
        "other.zh-TW.md",
        "other%2Ezh-TW%2Emd",
        "https://example.com/other.zh-TW.md?view=1",
    ],
)
def test_explicit_localized_markdown_destinations_are_rejected(docs_site, destination):
    docs_site.write_pair(
        f"# Link\n\nRead [the page]({destination}).\n",
        f"# 連結\n\n請閱讀[頁面]({destination})。\n",
    )

    assert_rule(docs_site.check(), "policy/explicit-locale-destination")


@pytest.mark.parametrize(
    "english, translation",
    [
        (
            "# This substantial English heading was copied without translation\n",
            "# This substantial English heading was copied without translation\n",
        ),
        (
            "# Paragraph\n\nThis substantial English paragraph was copied without translation.\n",
            "# 段落\n\nThis substantial English paragraph was copied without translation.\n",
        ),
        (
            "# List\n\n- This substantial English list item was copied without translation.\n",
            "# 清單\n\n- This substantial English list item was copied without translation.\n",
        ),
        (
            "# Table\n\n| Value |\n| --- |\n| This substantial English table cell was copied unchanged |\n",
            "# 表格\n\n| 值 |\n| --- |\n| This substantial English table cell was copied unchanged |\n",
        ),
        (
            '# Note\n\n!!! note "This substantial English admonition title stayed untranslated"\n    Complete English body.\n',
            '# 提示\n\n!!! note "This substantial English admonition title stayed untranslated"\n    完整的繁體中文內文。\n',
        ),
        (
            '# Tabs\n\n=== "This substantial English tab label stayed untranslated"\n    Complete English body.\n',
            '# 分頁\n\n=== "This substantial English tab label stayed untranslated"\n    完整的繁體中文內文。\n',
        ),
        (
            '# Cards\n\n<div class="grid cards" markdown>\n- This substantial English card prose was copied unchanged.\n</div>\n',
            '# 卡片\n\n<div class="grid cards" markdown>\n- This substantial English card prose was copied unchanged.\n</div>\n',
        ),
        (
            '# Link label\n\nRead [this substantial English source label copied unchanged](same.md) now.\n',
            '# 連結標籤\n\nRead [this substantial English source label copied unchanged](same.md) now.\n',
        ),
        (
            '# Image alt\n\n![This substantial English image description stayed untranslated](same.png)\n',
            '# 圖片替代文字\n\n![This substantial English image description stayed untranslated](same.png)\n',
        ),
        (
            '# Linked image alt\n\n[![This substantial English linked image description stayed untranslated](same.png)](same.md)\n',
            '# 連結圖片替代文字\n\n[![This substantial English linked image description stayed untranslated](same.png)](same.md)\n',
        ),
        (
            '# Raw prose\n\n<canvas>This substantial English raw visible prose stayed untranslated</canvas>\n',
            '# 原始文字\n\n<canvas>This substantial English raw visible prose stayed untranslated</canvas>\n',
        ),
    ],
)
def test_exact_clone_guard_covers_all_visible_surfaces(docs_site, english, translation):
    docs_site.write_pair(english, translation)

    assert_rule(docs_site.check(), "policy/untranslated-clone")


@pytest.mark.parametrize(
    "link_source, definition",
    [
        ("[Claude Code dynamic workflows and operational boundaries](https://example.com/source)", ""),
        ("[Claude Code dynamic workflows and operational boundaries][source]", "[source]: https://example.com/source"),
        ("[Claude Code dynamic workflows and operational boundaries][]", "[Claude Code dynamic workflows and operational boundaries]: https://example.com/source"),
        ("[Claude Code dynamic workflows and operational boundaries]", "[Claude Code dynamic workflows and operational boundaries]: https://example.com/source"),
        ("- [Claude Code dynamic workflows and operational boundaries](https://example.com/source)", ""),
    ],
)
def test_narrow_standalone_source_title_link_exemption(
    docs_site, link_source, definition
):
    source = f"# Sources\n\n{link_source}\n\n{definition}\n"
    docs_site.write_pair(source, source.replace("# Sources", "# 來源"))

    assert_valid(docs_site.check())


@pytest.mark.parametrize(
    "translation",
    [
        '<div class="highlight"><pre><code>same</code></pre><p>TODO</p></div>',
        '<div class="highlight"><table class="highlighttable"><tr><td class="linenos"><p>TODO</p></td></tr></table></div>',
    ],
)
def test_forged_highlight_scaffolds_cannot_hide_visible_todo(
    docs_site, translation
):
    english = translation.replace("TODO", "Complete English prose")
    docs_site.write_pair(f"# Policy\n\n{english}\n", f"# 政策\n\n{translation}\n")

    assert_rule(docs_site.check(), "policy/todo")


def test_forged_generated_tab_input_cannot_hide_duplicate_id(docs_site):
    source = (
        '<div class="tabbed-set"><input type="radio" name="__tabbed_x" '
        'id="__tabbed_x_1"><p id="__tabbed_x_1">Content</p></div>'
    )
    docs_site.write_pair(f"# IDs\n\n{source}\n", f"# 識別碼\n\n{source}\n")

    assert_rule(docs_site.check(), "anchor/duplicate-id")


@pytest.mark.parametrize(
    ("english", "translation"),
    [
        (
            "Read [this substantial English link label stayed untranslated](same.md).",
            "請閱讀[this substantial English link label stayed untranslated](same.md)。",
        ),
        (
            "View ![this substantial English image description stayed untranslated](same.png) now.",
            "立即查看![this substantial English image description stayed untranslated](same.png)。",
        ),
    ],
)
def test_link_and_image_text_clone_independently_of_surrounding_prose(
    docs_site, english, translation
):
    docs_site.write_pair(f"# Clone\n\n{english}\n", f"# 複製\n\n{translation}\n")

    assert_rule(docs_site.check(), "policy/untranslated-clone")


def test_long_technical_identifier_link_is_not_misclassified_as_prose(docs_site):
    identifier = "@earendil-works/pi-protocol"
    docs_site.write_pair(
        f"# Packages\n\nUse [`{identifier}`](https://example.com/package).\n",
        f"# 套件\n\n使用 [`{identifier}`](https://example.com/package)。\n",
    )

    assert_valid(docs_site.check())


def test_standalone_internal_link_is_not_a_source_title_exemption(docs_site):
    clone = "[This substantial English sentence is not a source title](target.md)"
    docs_site.write_pair(f"# Guide\n\n{clone}\n", f"# 指南\n\n{clone}\n")
    docs_site.write_pair("# Target\n", "# 目標\n", "target.md")

    assert_rule(docs_site.check(), "policy/untranslated-clone")


def test_standalone_external_sentence_outside_sources_is_not_exempt(docs_site):
    clone = (
        "[This substantial English sentence is not a source title]"
        "(https://example.com/guide)"
    )
    docs_site.write_pair(f"# Guide\n\n{clone}\n", f"# 指南\n\n{clone}\n")

    assert_rule(docs_site.check(), "policy/untranslated-clone")


def test_hidden_sources_heading_does_not_activate_clone_exemption(docs_site):
    clone = (
        "[This substantial English sentence is not a source title]"
        "(https://example.com/guide)"
    )
    docs_site.write_pair(
        f"<h2 hidden>Sources</h2>\n\n{clone}\n",
        f"<h2 hidden>來源</h2>\n\n{clone}\n",
    )

    assert_rule(docs_site.check(), "policy/untranslated-clone")


@pytest.mark.parametrize(
    "destination",
    [
        "https://example.com/page.md?next=other.zh-TW.md",
        "https://example.com/page.md#other.zh-TW.md",
    ],
)
def test_explicit_locale_policy_ignores_query_and_fragment(
    docs_site, destination
):
    docs_site.write_pair(
        f"# Link\n\n[English label]({destination}).\n",
        f"# 連結\n\n[繁體中文標籤]({destination})。\n",
    )

    assert "policy/explicit-locale-destination" not in rule_ids(docs_site.check())


def test_explicit_locale_policy_uses_normalized_path(docs_site):
    destination = "folder/../other%2Ezh-TW%2Emd?view=1#section"
    docs_site.write_pair(
        f"# Link\n\n[English label]({destination}).\n",
        f"# 連結\n\n[繁體中文標籤]({destination})。\n",
    )

    assert_rule(docs_site.check(), "policy/explicit-locale-destination")


def test_foreign_namespace_inert_content_and_template_filename_stay_inert(
    docs_site
):
    source = """<svg><script><text>TODO .specstory</text></script></svg>
<template><span class="filename">TODO</span></template>
"""
    docs_site.write_pair(
        f"# Inert\n\n{source}\nComplete English prose.\n",
        f"# 非作用中\n\n{source}\n完整繁體中文內容。\n",
    )

    rules = rule_ids(docs_site.check())
    assert "policy/todo" not in rules
    assert "policy/specstory" not in rules


def test_template_descendant_id_does_not_duplicate_active_document_id(docs_site):
    docs_site.write_pair(
        '# IDs\n\n<p id="same">English</p><template><span id="same">Inert</span></template>\n',
        '# 識別碼\n\n<p id="same">中文</p><template><span id="same">非作用中</span></template>\n',
    )

    assert "anchor/duplicate-id" not in rule_ids(docs_site.check())


def test_fragment_cannot_resolve_through_template_descendant_id(docs_site):
    docs_site.write_pair(
        '# Link\n\n[Jump](#inert)\n\n<template><span id="inert">Inert</span></template>\n',
        '# 連結\n\n[前往](#inert)\n\n<template><span id="inert">非作用中</span></template>\n',
    )

    assert_rule(docs_site.check(), "pair/destination")


def test_missing_and_orphan_locales_are_reported(docs_site):
    docs_site.write("missing.md", "# Missing\n")
    docs_site.write("orphan.zh-TW.md", "# 孤立\n")

    result = docs_site.check()

    assert {"inventory/missing-locale", "inventory/orphan-locale"} <= rule_ids(result)


def test_inventory_uses_mkdocs_default_exclusions(docs_site):
    docs_site.write_pair("# Page\n", "# 頁面\n")
    docs_site.write(".hidden.md", "# Excluded dotfile\n")
    docs_site.write("templates/escape.md", "# Excluded template\n")

    result = docs_site.check()
    assert result.pair_count == 1
    assert "inventory/missing-locale" not in rule_ids(result)


def test_inventory_rejects_acyclic_directory_symlink_to_external_static_content(
    docs_site, tmp_path
):
    docs_site.write_pair("# Page\n", "# 頁面\n")
    linked_source = tmp_path / "linked-source"
    linked_source.mkdir()
    (linked_source / "outside.bin").write_bytes(b"outside")
    link = docs_site.root / "assets" / "linked"
    link.parent.mkdir()
    try:
        link.symlink_to(linked_source, target_is_directory=True)
    except OSError as error:
        pytest.skip(f"directory symlinks are unavailable: {error}")

    result = docs_site.check()

    assert "inventory/symlink" in rule_ids(result)
    assert any(issue.path == "assets/linked" for issue in result.issues)


@pytest.mark.parametrize(
    "relative_path",
    ["linked.bin", "assets/linked.bin", "static/linked.bin", "templates/linked.bin"],
)
def test_inventory_rejects_file_symlinks_in_every_docs_subtree(
    docs_site, tmp_path, relative_path
):
    docs_site.write_pair("# Page\n", "# 頁面\n")
    target = tmp_path / "outside.bin"
    target.write_bytes(b"outside")
    link = docs_site.root / relative_path
    link.parent.mkdir(parents=True, exist_ok=True)
    try:
        link.symlink_to(target)
    except OSError as error:
        pytest.skip(f"file symlinks are unavailable: {error}")

    result = docs_site.check()

    assert "inventory/symlink" in rule_ids(result)
    assert any(issue.path == relative_path for issue in result.issues)


@pytest.mark.skipif(not hasattr(os, "mkfifo"), reason="FIFOs are unavailable")
def test_inventory_rejects_nonregular_static_asset_before_mkdocs(docs_site):
    docs_site.write_pair("# Page\n", "# 頁面\n")
    fifo = docs_site.root / "assets" / "stream.bin"
    fifo.parent.mkdir(parents=True)
    os.mkfifo(fifo)

    result = docs_site.check()

    assert "inventory/nonregular-file" in rule_ids(result)
    assert any(issue.path == "assets/stream.bin" for issue in result.issues)


@pytest.mark.parametrize("suffix", [".markdown", ".mdown", ".mkdn", ".mkd"])
def test_every_mkdocs_noncanonical_markdown_suffix_is_rejected(docs_site, suffix):
    docs_site.write_pair("# Page\n", "# 頁面\n")
    docs_site.write(f"escaped{suffix}", "# Published but noncanonical\n")

    result = docs_site.check()

    issue = next(
        issue
        for issue in result.issues
        if issue.rule_id == "inventory/noncanonical-markdown"
    )
    assert issue.path == f"escaped{suffix}"


def test_empty_page_and_empty_body_are_rejected(docs_site):
    docs_site.write_pair("", "")

    rules = rule_ids(docs_site.check())

    assert {"page/empty", "page/empty-body"} <= rules


def test_oversized_source_is_bounded(docs_site):
    oversized = "# Page\n\n" + "x" * (check_docs.MAX_FILE_BYTES + 1)
    docs_site.write_pair(oversized, oversized)

    assert "page/too-large" in rule_ids(docs_site.check())


def test_heading_flood_hits_source_line_bound_before_python_markdown(
    docs_site, monkeypatch
):
    profile, profile_issues = check_docs.load_renderer_profile(CONFIG_PATH)
    assert profile is not None
    assert profile_issues == ()

    heading_lines = [
        f"# Heading {index}" for index in range(check_docs.MAX_SOURCE_LINES + 1)
    ]
    heading_flood = "\n".join(heading_lines)
    assert len(heading_flood.splitlines()) > check_docs.MAX_SOURCE_LINES
    docs_site.write_pair(heading_flood, heading_flood)
    renderer_called = False

    def fail_if_rendered(*_args, **_kwargs):
        nonlocal renderer_called
        renderer_called = True
        raise AssertionError("line bound must run before Python-Markdown")

    monkeypatch.setattr(
        check_docs,
        "load_renderer_profile",
        lambda _config_path: (profile, ()),
    )
    monkeypatch.setattr(check_docs, "_render_page", fail_if_rendered)

    result = docs_site.check()

    assert "page/line-limit" in rule_ids(result)
    assert renderer_called is False


def test_source_line_bound_accepts_exact_upper_limit(docs_site):
    english_lines = [
        "# Page",
        "",
        "Complete English publication prose.",
        *([""] * (check_docs.MAX_SOURCE_LINES - 4)),
        "<!-- exact upper-bound sentinel -->",
    ]
    translated_lines = [
        "# 頁面",
        "",
        "完整的繁體中文出版內容。",
        *([""] * (check_docs.MAX_SOURCE_LINES - 4)),
        "<!-- exact upper-bound sentinel -->",
    ]
    assert len(english_lines) == len(translated_lines) == check_docs.MAX_SOURCE_LINES
    docs_site.write_pair("\n".join(english_lines), "\n".join(translated_lines))

    assert_valid(docs_site.check())


def test_descriptor_read_catches_growth_after_fstat(tmp_path, monkeypatch):
    path = tmp_path / "growing.md"
    path.write_bytes(b"small")
    original_fstat = check_docs.os.fstat
    grown = False

    def racing_fstat(descriptor):
        nonlocal grown
        result = original_fstat(descriptor)
        if not grown:
            grown = True
            path.write_bytes(b"x" * (check_docs.MAX_FILE_BYTES + 1))
        return result

    monkeypatch.setattr(check_docs.os, "fstat", racing_fstat)

    with pytest.raises(check_docs.SourceReadProblem) as caught:
        check_docs._read_bounded_source(path)

    assert caught.value.rule_id == "page/too-large"


def test_nonregular_markdown_target_is_rejected_before_read(docs_site):
    null_device = Path(os.devnull)
    docs_site.write("page.zh-TW.md", "# 頁面\n")
    try:
        (docs_site.root / "page.md").symlink_to(null_device)
    except OSError as error:
        pytest.skip(f"file symlinks are unavailable: {error}")

    assert "inventory/symlink" in rule_ids(docs_site.check())


@pytest.mark.skipif(not hasattr(os, "O_NOFOLLOW"), reason="O_NOFOLLOW unavailable")
def test_regular_file_symlink_is_rejected_without_following(docs_site, tmp_path):
    docs_site.root.mkdir(parents=True)
    target = tmp_path / "target.md"
    target.write_text("# Page\n", encoding="utf-8")
    docs_site.write("page.zh-TW.md", "# 頁面\n")
    try:
        (docs_site.root / "page.md").symlink_to(target)
    except OSError as error:
        pytest.skip(f"file symlinks are unavailable: {error}")

    assert "inventory/symlink" in rule_ids(docs_site.check())


def test_regular_file_symlink_is_rejected_without_o_nofollow(
    docs_site, tmp_path, monkeypatch
):
    docs_site.root.mkdir(parents=True)
    target = tmp_path / "target.md"
    target.write_text("# Page\n", encoding="utf-8")
    docs_site.write("page.zh-TW.md", "# 頁面\n")
    try:
        (docs_site.root / "page.md").symlink_to(target)
    except OSError as error:
        pytest.skip(f"file symlinks are unavailable: {error}")
    monkeypatch.setattr(check_docs.os, "O_NOFOLLOW", 0, raising=False)

    assert "inventory/symlink" in rule_ids(docs_site.check())


@pytest.mark.parametrize(
    "tag",
    ["blockquote", "details", 'div class="admonition note"'],
)
def test_direct_visible_text_in_raw_containers_is_policy_checked(docs_site, tag):
    name = tag.split()[0]
    docs_site.write_pair(
        f"# Raw container\n\n<{tag}>Complete English container prose.</{name}>\n",
        f"# 原始容器\n\n<{tag}>TODO</{name}>\n",
    )

    assert_rule(docs_site.check(), "policy/todo")


def test_closed_dialog_text_is_not_visible_but_open_dialog_text_is(docs_site):
    docs_site.write_pair(
        "# Dialog\n\n<dialog>TODO</dialog>\n",
        "# 對話框\n\n<dialog>TODO</dialog>\n",
    )
    assert "policy/todo" not in rule_ids(docs_site.check())

    docs_site.write_pair(
        "# Dialog\n\n<dialog open>TODO</dialog>\n",
        "# 對話框\n\n<dialog open>TODO</dialog>\n",
        "open.md",
    )
    assert_rule(docs_site.check(), "policy/todo")


def test_filesystem_inventory_is_bounded_before_mkdocs_allocation(docs_site, monkeypatch):
    docs_site.write_pair("# Page\n", "# 頁面\n")
    monkeypatch.setattr(check_docs, "MAX_INVENTORY_ENTRIES", 1)

    assert "inventory/entry-limit" in rule_ids(docs_site.check())


def test_srcset_candidate_inventory_is_bounded(docs_site, monkeypatch):
    source = '# Images\n\n<img alt="image" srcset="one.png 1x, two.png 2x">\n'
    docs_site.write_pair(source, source.replace("# Images", "# 圖片"))
    monkeypatch.setattr(check_docs, "MAX_RESOURCE_DESTINATIONS", 1)

    assert "render/model-failed" in rule_ids(docs_site.check())


def test_inventory_rejects_directory_symlink_cycle_without_following(docs_site):
    docs_site.write_pair("# Page\n", "# 頁面\n")
    try:
        (docs_site.root / "cycle").symlink_to(docs_site.root, target_is_directory=True)
    except OSError as error:
        pytest.skip(f"directory symlinks are unavailable: {error}")

    assert "inventory/symlink" in rule_ids(docs_site.check())


def test_directory_identity_guard_terminates_a_reported_cycle(docs_site, monkeypatch):
    docs_site.root.mkdir(parents=True)
    config = check_docs.load_config(
        config_file=str(CONFIG_PATH), docs_dir=str(docs_site.root)
    )
    config = config.plugins.on_config(config)
    root_stat = docs_site.root.stat()

    class CycleEntry:
        name = "cycle"
        path = str(docs_site.root / name)

        @staticmethod
        def stat(*, follow_symlinks):
            assert follow_symlinks is False
            return root_stat

    class Entries:
        def __enter__(self):
            return iter((CycleEntry(),))

        def __exit__(self, *_args):
            return False

    monkeypatch.setattr(check_docs.os, "scandir", lambda _path: Entries())

    with pytest.raises(check_docs.InventoryProblem) as caught:
        check_docs._bounded_mkdocs_files(config)

    assert caught.value.rule_id == "inventory/directory-cycle"


def test_published_file_count_is_bounded(docs_site, monkeypatch):
    docs_site.write_pair("# Page\n", "# 頁面\n")
    monkeypatch.setattr(check_docs, "MAX_PUBLISHED_FILES", 1)

    assert "inventory/file-limit" in rule_ids(docs_site.check())


def test_aggregate_source_bytes_are_bounded(docs_site, monkeypatch):
    docs_site.write_pair(
        "# Page\n\nComplete English prose.\n",
        "# 頁面\n\n完整的繁體中文內容。\n",
    )
    monkeypatch.setattr(check_docs, "MAX_TOTAL_SOURCE_BYTES", 20)

    assert "inventory/byte-limit" in rule_ids(docs_site.check())


def test_real_corpus_smoke_discovers_pairs_without_magic_count():
    result = check_docs.validate_documentation_root(
        REPO_ROOT / "docs",
        config_path=CONFIG_PATH,
    )

    assert result.pair_count > 0
    assert "inventory/missing-locale" not in rule_ids(result)
    assert "inventory/orphan-locale" not in rule_ids(result)
