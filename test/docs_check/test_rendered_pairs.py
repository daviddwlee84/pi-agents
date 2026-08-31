from __future__ import annotations

import pytest

from conftest import rule_ids
from scripts import check_docs


def assert_valid(result, pair_count=1):
    assert result.pair_count == pair_count
    assert result.issues == ()


def assert_rule(result, rule_id):
    assert rule_id in rule_ids(result), result.errors


def test_ignores_translated_prose_emphasis_and_soft_wrapping(docs_site):
    docs_site.write_pair(
        """# Overview

The *English paragraph* wraps at a different source location while preserving `pia`.
""",
        """# 概觀

繁體中文的**段落**可以在不同來源位置
換行，同時保留 `pia`。
""",
    )

    assert_valid(docs_site.check())


@pytest.mark.parametrize(
    "name, english, translation",
    [
        (
            "paragraph deletion",
            "# Page\n\nFirst complete paragraph.\n\nSecond complete paragraph.\n",
            "# 頁面\n\n第一個完整段落。\n",
        ),
        (
            "nested list flattening",
            "# List\n\n- Parent\n    - Nested child\n",
            "# 清單\n\n- 父項目\n- 被攤平的子項目\n",
        ),
        (
            "blockquote removal",
            "# Quote\n\n> Complete English quotation.\n",
            "# 引文\n\n完整的繁體中文引文。\n",
        ),
        (
            "definition marker removal",
            "# Terms\n\nTerm\n: Complete English definition.\n",
            "# 術語\n\n術語\n完整的繁體中文定義。\n",
        ),
        (
            "tight versus loose list",
            "# List\n\n- First item.\n- Second item.\n",
            "# 清單\n\n- 第一項。\n\n- 第二項。\n",
        ),
        (
            "hard break removal",
            "# Break\n\nFirst line.  \nSecond line.\n",
            "# 換行\n\n第一行。\n第二行。\n",
        ),
        (
            "table alignment",
            "# Table\n\n| Left | Right |\n| :--- | ---: |\n| a | b |\n",
            "# 表格\n\n| 左 | 右 |\n| ---: | ---: |\n| 甲 | 乙 |\n",
        ),
        (
            "raw table cell span",
            '# Table\n\n<table><tr><td colspan="2">English cell</td></tr></table>\n',
            '# 表格\n\n<table><tr><td colspan="1">繁體中文儲存格</td></tr></table>\n',
        ),
        (
            "details open state",
            "# Detail\n\n???+ note \"Title\"\n    Complete English detail.\n",
            "# 詳情\n\n??? note \"標題\"\n    完整的繁體中文詳情。\n",
        ),
        (
            "admonition kind",
            "# Note\n\n!!! warning \"Title\"\n    Complete English warning.\n",
            "# 提示\n\n!!! info \"標題\"\n    完整的繁體中文提示。\n",
        ),
        (
            "tab deletion",
            "# Tabs\n\n=== \"One\"\n    First tab.\n\n=== \"Two\"\n    Second tab.\n",
            "# 分頁\n\n=== \"一\"\n    第一個分頁。\n",
        ),
        (
            "card wrapper removal",
            "# Cards\n\n<div class=\"grid cards\" markdown>\n- Complete English card.\n</div>\n",
            "# 卡片\n\n- 完整的繁體中文卡片。\n",
        ),
        (
            "raw block nesting",
            "# Media\n\n<video controls><canvas>English fallback</canvas></video>\n",
            "# 媒體\n\n<video controls></video><canvas>繁體中文後備內容</canvas>\n",
        ),
        (
            "dialog placement",
            "# Dialog\n\n<section><dialog open>English dialog</dialog></section>\n",
            "# 對話框\n\n<dialog open><section>繁體中文對話框</section></dialog>\n",
        ),
    ],
)
def test_detects_rendered_structural_mutations(docs_site, name, english, translation):
    docs_site.write_pair(english, translation)

    assert_rule(docs_site.check(), "pair/structure")


def test_accepts_equivalent_setext_and_atx_headings_with_attrs(docs_site):
    docs_site.write_pair(
        "Stable heading {#stable}\n========================\n\nComplete English prose.\n",
        "# 穩定標題 {#穩定}\n\n完整的繁體中文內容。\n",
    )

    assert_valid(docs_site.check())


def test_superfences_in_tabs_and_admonitions_compare_exact_code(docs_site):
    english = """# Code

=== "Shell"
    ```bash
    command --safe
    ```

!!! note "Example"
    ```python
    print("stable")
    ```
"""
    translation = """# 程式碼

=== "Shell"
    ```bash
    command --safe
    ```

!!! note "範例"
    ```python
    print("changed")
    ```
"""
    docs_site.write_pair(english, translation)

    assert_rule(docs_site.check(), "pair/block-code")


def test_classic_indented_and_raw_pre_code_compare_exactly(docs_site):
    docs_site.write_pair(
        """# Literal code

    command --safe

<pre class="raw"><code class="language-shell">a&amp;b
</code></pre>
""",
        """# 字面程式碼

    command --unsafe

<pre class="raw"><code class="language-shell">a&amp;b
</code></pre>
""",
    )

    assert_rule(docs_site.check(), "pair/block-code")


def test_highlight_semantic_classes_are_part_of_block_code(docs_site):
    source = "const answer = true;\n"
    docs_site.write_pair(
        f"# Code\n\n```javascript\n{source}```\n",
        f"# 程式碼\n\n```text\n{source}```\n",
    )

    assert_rule(docs_site.check(), "pair/block-code")


def test_equivalent_pygments_descendant_shapes_are_canonical(docs_site):
    source = 'value = 1\nprint(f"value={value}")\n'
    docs_site.write_pair(
        f"# Code\n\n```python\n{source}```\n",
        f"# 程式碼\n\n```python\n{source}```\n",
    )

    assert_valid(docs_site.check())


@pytest.mark.parametrize(
    ("english_code", "translation_code"),
    [
        ("Alpha<br>Beta", "AlphaBeta"),
        ("<button>Alpha</button>Beta", "AlphaBeta"),
        (
            '<span data-origin="authored">Alpha</span>Beta',
            '<span data-origin="changed">Alpha</span>Beta',
        ),
        (
            '<span><a id="__codelineno-1-1" name="__codelineno-1-1" '
            'href="#__codelineno-1-1"></a>Alpha</span>Beta',
            "<span>Alpha</span>Beta",
        ),
    ],
)
def test_code_descendant_tags_and_attributes_are_structural(
    docs_site, english_code, translation_code
):
    docs_site.write_pair(
        "# Code\n\n"
        f'<div class="highlight"><pre><span></span><code>{english_code}</code></pre></div>\n',
        "# 程式碼\n\n"
        f'<div class="highlight"><pre><span></span><code>{translation_code}</code></pre></div>\n',
    )

    assert_rule(docs_site.check(), "pair/structure")


@pytest.mark.parametrize(
    ("english_code", "translation_code"),
    [
        ("Alpha<br>Beta", "Al<br>phaBeta"),
        (
            "<button>Alpha</button>Beta",
            "Alpha<button>Beta</button>",
        ),
    ],
    ids=["void-element-tail-offset", "element-text-versus-tail"],
)
def test_code_descendant_text_and_tail_placement_is_structural(
    docs_site, english_code, translation_code
):
    docs_site.write_pair(
        "# Code\n\n"
        f'<div class="highlight"><pre><span></span><code>{english_code}</code></pre></div>\n',
        "# 程式碼\n\n"
        f'<div class="highlight"><pre><span></span><code>{translation_code}</code></pre></div>\n',
    )

    assert_rule(docs_site.check(), "pair/structure")


def test_highlight_class_ranges_preserve_which_code_line_is_marked(docs_site):
    code = "value = 1\nvalue = 2\n"
    docs_site.write_pair(
        f'# Highlight\n\n```python hl_lines="1"\n{code}```\n',
        f'# 高亮\n\n```python hl_lines="2"\n{code}```\n',
    )

    assert_rule(docs_site.check(), "pair/block-code")


def test_code_line_number_start_and_filename_are_semantic(docs_site):
    code = "value = 1\nvalue = 2\n"
    docs_site.write_pair(
        f'# Presentation\n\n```python linenums="5" title="safe.py"\n{code}```\n',
        f'# 呈現\n\n```python linenums="10" title="unsafe.py"\n{code}```\n',
    )

    assert_rule(docs_site.check(), "pair/block-code")


def test_reference_autolink_html_and_nested_image_destinations_are_ordered(docs_site):
    english = """# Resources

[![Diagram](diagram.png)][guide] and <https://example.com/home>.

[guide]: guide.md?mode=stable#section

<a
  href="extra.md?x=1&amp;y=2"><img src="extra.png" alt="Extra"></a>
"""
    translation = """# 資源

[![圖表](diagram.png)][指南]與 <https://example.com/home>。

[指南]: guide.md?mode=stable#section

<a
  href="extra.md?x=1&amp;y=2"><img src="changed.png" alt="額外"></a>
"""
    docs_site.write_pair(english, translation)

    assert_rule(docs_site.check(), "pair/destination")


def test_logical_markdown_dot_path_is_canonicalized_at_source_layer(docs_site):
    docs_site.write_pair(
        "# Source\n\nRead [target](target.md).\n",
        "# 來源\n\n請閱讀[目標](./target.md)。\n",
        "source.md",
    )
    docs_site.write_pair("# Target\n", "# 目標\n", "target.md")

    assert_valid(docs_site.check(), pair_count=2)


@pytest.mark.parametrize(
    ("english", "translation"),
    [
        ('<video poster="one.png"></video>', '<video poster="two.png"></video>'),
        ('<form action="one.md"></form>', '<form action="two.md"></form>'),
        (
            '<button formaction="one.md">English</button>',
            '<button formaction="two.md">中文</button>',
        ),
        (
            '<blockquote cite="one.md">English</blockquote>',
            '<blockquote cite="two.md">中文</blockquote>',
        ),
        ('<object data="one.bin"></object>', '<object data="two.bin"></object>'),
        (
            '<svg><a xlink:href="one.md">English</a></svg>',
            '<svg><a xlink:href="two.md">中文</a></svg>',
        ),
        (
            '<img alt="English" srcset="one.png 1x, two.png 2x">',
            '<img alt="中文" srcset="one.png 1x, changed.png 2x">',
        ),
        (
            '<img alt="English" srcset="same.png 1x">',
            '<img alt="中文" srcset="same.png 2x">',
        ),
    ],
)
def test_browser_resource_attributes_and_srcset_candidates_are_ordered(
    docs_site, english, translation
):
    docs_site.write_pair(
        f"# Resource\n\n{english}\n", f"# 資源\n\n{translation}\n"
    )

    assert_rule(docs_site.check(), "pair/destination")


def test_empty_rendered_destination_is_not_dropped(docs_site):
    docs_site.write_pair(
        "# Empty\n\n[English label]().\n",
        "# 空白\n\n[繁體中文標籤](changed.md)。\n",
    )

    assert_rule(docs_site.check(), "pair/destination")


@pytest.mark.parametrize("tag", ["pre", "code"])
def test_raw_links_inside_literal_elements_remain_active_destinations(docs_site, tag):
    docs_site.write_pair(
        f'# Raw link\n\n<{tag}><a href="stable.md">same</a></{tag}>\n',
        f'# 原始連結\n\n<{tag}><a href="changed.md">same</a></{tag}>\n',
    )

    assert_rule(docs_site.check(), "pair/destination")


def test_raw_video_source_destination_is_compared(docs_site):
    docs_site.write_pair(
        '# Video\n\n<video><source src="stable.mp4"></video>\n',
        '# 影片\n\n<video><source src="changed.mp4"></video>\n',
    )

    assert_rule(docs_site.check(), "pair/destination")


def test_inline_code_allows_reordering_and_bounded_new_annotations(docs_site):
    docs_site.write_pair(
        "# Commands\n\nUse `alpha` before `beta` in the English explanation.\n",
        "# 指令\n\n繁體中文說明可先談 `beta`，補上 `annotation`，再談 `alpha`。\n",
    )

    assert_valid(docs_site.check())


@pytest.mark.parametrize(
    "translation",
    [
        "# 指令\n\n請使用 `prefix alpha` 與 `beta`。\n",
        "# 指令\n\n請使用 `alpha`，但遺漏第二個必要的值。\n",
    ],
)
def test_inline_code_rejects_prefix_or_missing_multiplicity(docs_site, translation):
    docs_site.write_pair(
        "# Commands\n\nUse `alpha`, `alpha`, and `beta`.\n",
        translation,
    )

    assert_rule(docs_site.check(), "pair/inline-code")


def test_inline_code_additions_are_bounded(docs_site):
    extras = " ".join(f"`extra-{index}`" for index in range(9))
    docs_site.write_pair(
        "# Command\n\nUse `required`.\n",
        f"# 指令\n\n請使用 `required`，並加入 {extras}。\n",
    )

    assert_rule(docs_site.check(), "pair/inline-code")


def test_stable_facts_are_ordered_per_aligned_visible_unit(docs_site):
    docs_site.write_pair(
        """# Facts

Alpha uses v1.2.3 on 2026-08-31 at abc1234 under GHSA-abcd-1234-efgh.

Beta uses v9.8.7 on 2026-08-30 at def5678.
""",
        """# 事實

Alpha 於 2026-08-31 使用 v9.8.7，提交為 abc1234，公告為 GHSA-abcd-1234-efgh。

Beta 於 2026-08-30 使用 v1.2.3，提交為 def5678。
""",
    )

    assert_rule(docs_site.check(), "pair/stable-facts")


def test_date_tokens_survive_sentence_terminal_punctuation(docs_site):
    docs_site.write_pair(
        "# Date\n\nThe review finished on 2026-08-31.\n",
        "# 日期\n\n審查完成於 2026-08-31。\n",
    )

    assert_valid(docs_site.check())


def test_stable_date_facts_are_not_limited_to_modern_years(docs_site):
    docs_site.write_pair(
        "# History\n\nAlpha was recorded in 1899 and Beta in 1888.\n",
        "# 歷史\n\nAlpha 記於 1888，Beta 記於 1899。\n",
    )

    assert_rule(docs_site.check(), "pair/stable-facts")


def test_all_letter_abbreviated_commit_is_preserved_without_matching_feedback(docs_site):
    docs_site.write_pair(
        "# Commit\n\nThe feedback points to commit deadbee.\n",
        "# 提交\n\n意見回饋指向提交 deadbef。\n",
    )

    assert_rule(docs_site.check(), "pair/stable-facts")


def test_localized_same_page_fragment_resolves_by_corresponding_heading(docs_site):
    docs_site.write_pair(
        """# Page

## Setup {#setup}

Read [setup](#setup).
""",
        """# 頁面

## 設定 {#設定}

請閱讀[設定](#設定)。
""",
    )

    assert_valid(docs_site.check())


def test_percent_encoded_localized_fragments_use_decoded_rendered_targets(docs_site):
    docs_site.write_pair(
        "# Page\n\n## Setup {#setup}\n\n[Jump](#set%75p)\n",
        "# 頁面\n\n## 設定 {#設定}\n\n[前往](#%E8%A8%AD%E5%AE%9A)\n",
    )

    assert_valid(docs_site.check())


def test_localized_relative_markdown_fragment_resolves_in_paired_target(docs_site):
    docs_site.write_pair(
        "# Source\n\nRead [target](target.md#setup).\n",
        "# 來源\n\n請閱讀[目標](target.md#設定)。\n",
        "source.md",
    )
    docs_site.write_pair(
        "# Target\n\n## Setup {#setup}\n\nComplete English target.\n",
        "# 目標\n\n## 設定 {#設定}\n\n完整的繁體中文目標。\n",
        "target.md",
    )

    assert_valid(docs_site.check(), pair_count=2)


@pytest.mark.parametrize(
    "english_href, translated_href",
    [
        ("#missing", "#不存在"),
        ("route#setup", "route#設定"),
        ("target.md#missing", "target.md#不存在"),
    ],
)
def test_rejects_unresolved_or_extensionless_localized_fragments(
    docs_site, english_href, translated_href
):
    docs_site.write_pair(
        f"# Source\n\nRead [target]({english_href}).\n",
        f"# 來源\n\n請閱讀[目標]({translated_href})。\n",
        "source.md",
    )
    if english_href.startswith("target.md"):
        docs_site.write_pair(
            "# Target\n\n## Existing {#existing}\n",
            "# 目標\n\n## 已存在 {#已存在}\n",
            "target.md",
        )

    assert_rule(docs_site.check(), "pair/destination")


def test_localized_block_attribute_fragment_uses_block_ordinal(docs_site):
    docs_site.write_pair(
        "# Page\n\nEnglish target paragraph.\n{#target}\n\n[Jump](#target)\n",
        "# 頁面\n\n繁體中文目標段落。\n{#目標}\n\n[前往](#目標)\n",
    )

    assert_valid(docs_site.check())


def test_anchor_shape_and_duplicate_ids_are_checked(docs_site):
    docs_site.write_pair(
        '# IDs\n\n<h2 id="same">First</h2><p id="same">Second</p>\n',
        '# 識別碼\n\n<h2 id="一">第一</h2><p id="二">第二</p>\n',
    )

    result = docs_site.check()

    assert_rule(result, "anchor/duplicate-id")


def test_authored_reserved_looking_ids_are_not_discarded(docs_site):
    docs_site.write_pair(
        '# IDs\n\n<div id="__tabbed_custom"></div><section id="__tabbed_custom"></section>\n',
        '# 識別碼\n\n<div id="__tabbed_custom"></div><section id="__tabbed_custom"></section>\n',
    )

    assert_rule(docs_site.check(), "anchor/duplicate-id")


def test_duplicate_empty_ids_are_still_duplicate_ids(docs_site):
    docs_site.write_pair(
        '# IDs\n\n<div id=""></div><section id=""></section>\n',
        '# 識別碼\n\n<div id=""></div><section id=""></section>\n',
    )

    assert_rule(docs_site.check(), "anchor/duplicate-id")


def test_image_only_heading_and_entities_use_rendered_ids(docs_site):
    docs_site.write_pair(
        "# ![Architecture &amp; safety](diagram.png)\n\n[Jump](#_1)\n",
        "# ![架構與安全](diagram.png)\n\n[前往](#_1)\n",
    )

    assert_valid(docs_site.check())


def test_footnote_labels_can_be_localized_and_reference_links_still_compare(docs_site):
    docs_site.write_pair(
        """# Footnote

English claim.[^source]

[^source]: English note with [reference](same.md).
""",
        """# 註腳

繁體中文主張。[^來源]

[^來源]: 繁體中文註記含有[參考資料](same.md)。
""",
    )

    assert_valid(docs_site.check())


def test_md_in_html_block_and_span_modes_use_renderer_output(docs_site):
    docs_site.write_pair(
        """# HTML modes

<section markdown="1">
## Rendered child

[Rendered link](stable.md)
</section>

<p markdown="1">A # marker stays inline with [the same link](same.md).</p>
""",
        """# HTML 模式

<section markdown="1">
## 顯示的子項目

[顯示的連結](changed.md)
</section>

<p markdown="1"># 記號保持行內，並含有[相同連結](same.md)。</p>
""",
    )

    assert_rule(docs_site.check(), "pair/destination")


def test_raw_html_without_markdown_and_markdown_zero_stay_opaque_to_markdown(docs_site):
    docs_site.write_pair(
        """# Raw

<div>
[Markdown-looking text](one.md)
```text
English backticks
```
</div>

<section markdown="0">[also raw](one.md)</section>
<script>const fake = '<a href="one.md">link</a>';</script>
""",
        """# 原始內容

<div>
[看似 Markdown 的文字](two.md)
```text
English backticks
```
</div>

<section markdown="0">[也是原始內容](two.md)</section>
<script>const fake = '<a href="two.md">link</a>';</script>
""",
    )

    assert_valid(docs_site.check())


def test_definition_list_tightness_is_rendered_structure(docs_site):
    docs_site.write_pair(
        """# Definition

Term
: First English definition paragraph.

    Second English definition paragraph.
""",
        """# 定義

術語
: 第一個繁體中文定義段落。
    第二個繁體中文定義段落。
""",
    )

    assert_rule(docs_site.check(), "pair/structure")


def test_localized_fragment_exception_does_not_apply_to_resource_src(docs_site):
    docs_site.write_pair(
        "# Image\n\n![Diagram](target.md#english)\n",
        "# 圖片\n\n![圖表](target.md#translated)\n",
        "source.md",
    )
    docs_site.write_pair(
        "# English {#english}\n",
        "# 翻譯 {#translated}\n",
        "target.md",
    )

    assert_rule(docs_site.check(), "pair/destination")


def test_nested_container_movement_is_detected_recursively(docs_site):
    docs_site.write_pair(
        """# Containers

- Parent item

    > English quote nested in the list.
""",
        """# 容器

- 父項目

> 被移出清單的繁體中文引文。
""",
    )

    assert_rule(docs_site.check(), "pair/structure")


@pytest.mark.parametrize(
    ("english", "translation"),
    [
        (
            "<table>English fostered text<tr><td>English</td></tr></table>",
            "<table><tr><td>中文</td></tr></table>",
        ),
        (
            "<section>English</section>English top-level tail<section>More</section>",
            "<section>中文</section><section>更多</section>",
        ),
    ],
)
def test_fragment_root_text_and_top_level_tails_are_structural(
    docs_site, english, translation
):
    docs_site.write_pair(f"# Root\n\n{english}\n", f"# 根節點\n\n{translation}\n")

    assert_rule(docs_site.check(), "pair/structure")


def test_noncanonical_highlight_and_tab_wrappers_preserve_authored_children(
    docs_site
):
    docs_site.write_pair(
        """# Raw wrappers

<div class="highlight"><pre><code>same</code></pre><p>English one.</p><p><a href="one.md">English two.</a></p></div>
<div class="tabbed-set"><p>English one.</p><p>English two.</p></div>
""",
        """# 原始包裝

<div class="highlight"><pre><code>same</code></pre><p>繁中一。</p><p><a href="two.md">繁中二。</a></p></div>
<div class="tabbed-set"><p>繁中一。</p></div>
""",
    )

    rules = rule_ids(docs_site.check())
    assert "pair/destination" in rules
    assert "pair/structure" in rules


def test_forged_linenos_classes_cannot_hide_resource_destinations(docs_site):
    docs_site.write_pair(
        '# Links\n\n<div class="highlight"><table class="highlighttable"><tr><td class="linenos"><a href="one.md">English</a></td><td><pre><code>same</code></pre></td></tr></table></div>\n',
        '# 連結\n\n<div class="highlight"><table class="highlighttable"><tr><td class="linenos"><a href="two.md">中文</a></td><td><pre><code>same</code></pre></td></tr></table></div>\n',
    )

    assert_rule(docs_site.check(), "pair/destination")


def test_html5lib_repairs_equivalent_malformed_raw_html(docs_site):
    docs_site.write_pair(
        "# Repair\n\n<section><p>Complete <strong>English prose</section>\n",
        "# 修復\n\n<section><p>完整的<strong>繁體中文內容</section>\n",
    )

    assert_valid(docs_site.check())


def test_html_entity_decoded_destinations_compare_semantically(docs_site):
    docs_site.write_pair(
        "# Entity\n\n[English](page.md?a=1&amp;b=2).\n",
        "# 字元實體\n\n[繁體中文](page.md?a=1&#38;b=2)。\n",
    )

    assert_valid(docs_site.check())


def test_localized_fragments_must_resolve_to_same_rendered_ordinal(docs_site):
    docs_site.write_pair(
        """# Page

## First {#first}

## Second {#second}

[Jump](#first)
""",
        """# 頁面

## 第一 {#第一}

## 第二 {#第二}

[前往](#第二)
""",
    )

    assert_rule(docs_site.check(), "pair/destination")


def test_script_src_is_a_rendered_resource_destination(docs_site):
    docs_site.write_pair(
        '# Script\n\n<script src="stable.js"></script>\n',
        '# 腳本\n\n<script src="changed.js"></script>\n',
    )

    assert_rule(docs_site.check(), "pair/destination")


def test_dom_attributes_are_not_entity_decoded_twice(docs_site):
    docs_site.write_pair(
        '# Link\n\n<a href="page.md?a=1&amp;amp;y=2">English</a>\n',
        '# 連結\n\n<a href="page.md?a=1&amp;y=2">繁體中文</a>\n',
    )

    assert_rule(docs_site.check(), "pair/destination")


@pytest.mark.parametrize(
    ("english_href", "translated_href"),
    [
        ("target.MD#setup", "target.MD#設定"),
        ("http://[#setup", "http://[#設定"),
    ],
)
def test_malformed_or_noncanonical_localized_targets_fail_without_throwing(
    docs_site, english_href, translated_href
):
    docs_site.write_pair(
        f'# Link\n\n<a href="{english_href}">English</a>\n',
        f'# 連結\n\n<a href="{translated_href}">繁體中文</a>\n',
    )

    assert_rule(docs_site.check(), "pair/destination")


def test_authored_linenos_class_does_not_hide_raw_pre_code(docs_site):
    docs_site.write_pair(
        '# Code\n\n<div class="linenos"><pre><code>command --safe</code></pre></div>\n',
        '# 程式碼\n\n<div class="linenos"><pre><code>command --unsafe</code></pre></div>\n',
    )

    assert_rule(docs_site.check(), "pair/block-code")


@pytest.mark.parametrize(
    ("english", "translation"),
    [
        (
            "# Hidden\n\n<section>English content</section>\n",
            "# 隱藏\n\n<section hidden>繁體中文內容</section>\n",
        ),
        (
            "# Dialog\n\n<dialog open>English content</dialog>\n",
            "# 對話框\n\n<dialog>繁體中文內容</dialog>\n",
        ),
    ],
)
def test_rendered_visibility_attributes_are_structural(docs_site, english, translation):
    docs_site.write_pair(english, translation)

    assert_rule(docs_site.check(), "pair/structure")


def test_table_alignment_uses_last_winning_css_declaration(docs_site):
    docs_site.write_pair(
        '# Table\n\n<table><tr><td style="text-align:left;text-align:right">English</td></tr></table>\n',
        '# 表格\n\n<table><tr><td style="text-align:left">繁體中文</td></tr></table>\n',
    )

    assert_rule(docs_site.check(), "pair/structure")


@pytest.mark.parametrize(
    ("english", "translation"),
    [
        (
            '<ol reversed type="A" start="5"><li value="9">English</li></ol>',
            '<ol type="A" start="5"><li value="9">中文</li></ol>',
        ),
        (
            '<ol type="A" start="5"><li value="9">English</li></ol>',
            '<ol type="i" start="2"><li value="1">中文</li></ol>',
        ),
        (
            '<details name="group-one"><summary>English</summary></details>',
            '<details name="group-two"><summary>中文</summary></details>',
        ),
        (
            "<section>English</section>",
            '<section style="display:none">中文</section>',
        ),
    ],
)
def test_browser_semantic_attributes_are_structural(
    docs_site, english, translation
):
    docs_site.write_pair(
        f"# Semantics\n\n{english}\n", f"# 語意\n\n{translation}\n"
    )

    assert_rule(docs_site.check(), "pair/structure")


def test_invalid_text_align_falls_back_to_valid_align_attribute(docs_site):
    docs_site.write_pair(
        '# Table\n\n<table><tr><td style="text-align:bogus" align="right">English</td></tr></table>\n',
        '# 表格\n\n<table><tr><td align="right">繁體中文</td></tr></table>\n',
    )

    assert_valid(docs_site.check())


def test_identical_fragments_resolve_to_corresponding_target_ordinals(docs_site):
    docs_site.write_pair(
        """# Page

## First {#shared}

## Second {#other}

[Jump](#shared)
""",
        """# 頁面

## 第一 {#other}

## 第二 {#shared}

[前往](#shared)
""",
    )

    assert_rule(docs_site.check(), "pair/destination")


def test_duplicate_fragment_targets_are_not_overwritten_in_anchor_index(docs_site):
    source = '# IDs\n\n<h2 id="same">One</h2><p id="same">Two</p>\n\n[Jump](#same)\n'
    docs_site.write_pair(source, source.replace("# IDs", "# 識別碼"))

    result = docs_site.check()

    assert_rule(result, "anchor/duplicate-id")
    assert_rule(result, "pair/destination")


def test_anchor_targets_are_preindexed_without_overwriting_duplicates():
    profile, issues = check_docs.load_renderer_profile()
    assert profile is not None
    assert issues == ()
    collector = check_docs._IssueCollector()

    model = check_docs._render_page(
        "page.md",
        '<h2 id="same">One</h2><p id="same">Two</p>',
        profile,
        collector,
    )

    assert model is not None
    assert len(model.anchor_index["same"]) == 2
    assert model.target_for_fragment("same") is None
    assert collector.finish() == ()


def test_code_text_is_snapshotted_before_generated_ui_classification(monkeypatch):
    fragment = check_docs.html5lib.parseFragment(
        "<pre><code>original code text</code></pre>"
    )

    def mutate_after_capture(builder):
        code = next(
            element for element in builder.fragment.iter() if check_docs._tag(element) == "code"
        )
        code.text = "mutated after raw evidence"

    monkeypatch.setattr(
        check_docs._DomModelBuilder,
        "_classify_generated_ui",
        mutate_after_capture,
    )

    model = check_docs._DomModelBuilder("page.md", fragment).build()

    assert model.block_codes[0].pre_text == "original code text"
    assert model.block_codes[0].code_text == "original code text"


def test_code_title_classes_and_rendered_attributes_are_semantic(docs_site):
    docs_site.write_pair(
        '# Code\n\n<pre class="sample" title="safe.py" data-start="5"><code class="language-python">same</code></pre>\n',
        '# 程式碼\n\n<pre class="changed" title="unsafe.py" data-start="9"><code class="language-text">same</code></pre>\n',
    )

    assert_rule(docs_site.check(), "pair/block-code")
