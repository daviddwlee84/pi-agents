#!/usr/bin/env python3
"""Check bounded documentation invariants with the configured renderer.

This docs-only source checker enforces bounded rendered structural/lexical and
metadata/source-policy invariants. It DOES NOT prove translation meaning,
completeness, factual equivalence, same-shaped translated prose identity or
order, arbitrary browser CSS/JS behavior, or full MkDocs ``Page.render``
equivalence. Source-level destination canonicalization and
``mkdocs build --strict`` are separate validation layers. Source line caps are
DoS/resource bounds, not translation semantics.
"""

from __future__ import annotations

import argparse
import datetime as dt
import errno
import math
import os
import posixpath
import re
import stat
import sys
import unicodedata
import urllib.parse
from collections import Counter, defaultdict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from types import MappingProxyType
from typing import Any, TypeAlias
from xml.etree import ElementTree as ET

import html5lib
import markdown
import yaml
from mkdocs import utils as mkdocs_utils
from mkdocs.config import load_config
from mkdocs.structure.files import File, Files, InclusionLevel, set_exclusions
from mkdocs.utils import meta as mkdocs_meta
from yaml.composer import ComposerError
from yaml.constructor import ConstructorError
from yaml.events import AliasEvent
from yaml.nodes import MappingNode

CONTRACT = (
    "Enforces bounded rendered structural/lexical and metadata/source-policy "
    "invariants. DOES NOT prove translation meaning, completeness, factual "
    "equivalence, same-shaped translated prose identity/order, arbitrary "
    "browser CSS/JS behavior, or full MkDocs Page.render equivalence. "
    "Source destination canonicalization and `mkdocs build --strict` are "
    "separate layers. Source line caps are DoS/resource bounds, not "
    "translation semantics."
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "mkdocs.yml"

# These are the suffixes MkDocs 1.6 publishes as documentation pages. The
# profile assertion below makes a future MkDocs expansion fail visibly.
MARKDOWN_SUFFIXES = tuple(mkdocs_utils.markdown_extensions)
CANONICAL_SUFFIX = ".md"
EXPECTED_MARKDOWN_SUFFIXES = (".markdown", ".mdown", ".mkdn", ".mkd", ".md")

EXPECTED_MARKDOWN_EXTENSIONS = (
    "toc",
    "tables",
    "fenced_code",
    "admonition",
    "attr_list",
    "def_list",
    "footnotes",
    "md_in_html",
    "pymdownx.details",
    "pymdownx.highlight",
    "pymdownx.inlinehilite",
    "pymdownx.superfences",
    "pymdownx.tabbed",
)
EXPECTED_MDX_CONFIGS: tuple[tuple[str, Any], ...] = (
    ("pymdownx.highlight", (("anchor_linenums", True),)),
    ("pymdownx.tabbed", (("alternate_style", True),)),
    ("toc", (("permalink", True),)),
)
EXPECTED_PLUGINS = (
    ("i18n", "mkdocs_static_i18n.plugin", "I18n"),
    ("material/search", "material.plugins.search.plugin", "SearchPlugin"),
)
EXPECTED_DEFAULT_LOCALE = "en"
EXPECTED_NONDEFAULT_LOCALES = ("zh-TW",)

MAX_FILE_BYTES = 1_048_576
# The 348-line corpus maximum (verified 2026-08-31) has ample headroom. This
# limit is a pre-render DoS/resource bound against inputs such as heading floods;
# it does not add a translation-quality assertion.
MAX_SOURCE_LINES = 2_000
MAX_INVENTORY_ENTRIES = 20_000
MAX_INVENTORY_DIRECTORIES = 4_096
MAX_INVENTORY_DEPTH = 128
MAX_PUBLISHED_FILES = 4_096
MAX_TOTAL_SOURCE_BYTES = 67_108_864
MAX_SITE_HTML_FILES = 4_096
MAX_SITE_HTML_BYTES = 4_194_304
MAX_TOTAL_SITE_HTML_BYTES = 67_108_864
MAX_FRONTMATTER_BYTES = 65_536
MAX_METADATA_LINES = 2_048
MAX_RENDERED_BYTES = 4_194_304
MAX_YAML_ALIASES = 64
MAX_YAML_NODES = 2_048
MAX_YAML_DEPTH = 32
MAX_YAML_EXPANDED_NODES = 8_192
MAX_DOM_NODES = 100_000
MAX_DOM_DEPTH = 128
MAX_RESOURCE_DESTINATIONS = 100_000
MAX_DIAGNOSTICS = 512
MAX_MESSAGE = 512
MAX_EXCERPT = 160
MAX_PATH = 512
MAX_EXTRA_INLINE_CODES_PER_UNIT = 8
READ_CHUNK_BYTES = 65_536

NOTE_KEYS = ("kind", "status", "as_of", "last_verified", "upstreams", "confidence")
RESOURCE_ATTRIBUTES = (
    "href",
    "src",
    "srcset",
    "poster",
    "action",
    "formaction",
    "cite",
    "data",
)

FrozenValue: TypeAlias = str | int | float | bool | None | tuple[Any, ...]
AnchorSignature: TypeAlias = tuple[str, str, int, int, bool, bool]
Element = ET.Element


@dataclass(frozen=True, slots=True)
class Issue:
    """A deterministic, source-honest checker diagnostic."""

    rule_id: str
    path: str
    message: str
    paired_path: str | None = None
    source_line: int | None = None
    rendered_ordinal: int | None = None
    excerpt: str | None = None

    def sort_key(self) -> tuple[Any, ...]:
        return (
            self.path,
            self.rule_id,
            self.source_line if self.source_line is not None else sys.maxsize,
            self.rendered_ordinal if self.rendered_ordinal is not None else sys.maxsize,
            self.paired_path or "",
            self.message,
            self.excerpt or "",
        )

    def format(self) -> str:
        locations: list[str] = []
        if self.source_line is not None:
            locations.append(f"source line {self.source_line}")
        if self.rendered_ordinal is not None:
            locations.append(f"rendered unit {self.rendered_ordinal}")
        suffix = f" ({', '.join(locations)})" if locations else ""
        paired = (
            f" [paired with {_bounded_path(self.paired_path)}]"
            if self.paired_path
            else ""
        )
        excerpt = (
            f" — {_bounded_excerpt(self.excerpt)}" if self.excerpt else ""
        )
        return (
            f"{_bounded_path(self.path)}: {self.rule_id}: "
            f"{_bounded_message(self.message)}{suffix}{paired}{excerpt}"
        )


@dataclass(frozen=True, slots=True)
class CheckResult:
    pair_count: int
    issues: tuple[Issue, ...]

    @property
    def errors(self) -> tuple[str, ...]:
        """Compatibility convenience for callers that want rendered messages."""

        return tuple(issue.format() for issue in self.issues)


@dataclass(frozen=True, slots=True)
class SiteCheckResult:
    html_file_count: int
    issues: tuple[Issue, ...]

    @property
    def errors(self) -> tuple[str, ...]:
        return tuple(issue.format() for issue in self.issues)


@dataclass(frozen=True, slots=True)
class _SiteDestination:
    ordinal: int
    kind: str
    value: str


@dataclass(frozen=True, slots=True)
class _SitePage:
    path: str
    fragment_targets: frozenset[str]
    destinations: tuple[_SiteDestination, ...]
    base_href: str | None


@dataclass(frozen=True, slots=True)
class _SiteLocation:
    scheme: str
    hostname: str
    port: int
    path_prefix: str


@dataclass(frozen=True, slots=True)
class _SiteUrl:
    path: str
    fragment: str | None


@dataclass(frozen=True, slots=True)
class RendererProfile:
    config_path: Path
    docs_dir: Path
    default_locale: str
    nondefault_locales: tuple[str, ...]
    markdown_extensions: tuple[str, ...]
    mdx_configs: tuple[tuple[str, FrozenValue], ...]


@dataclass(frozen=True, slots=True)
class Shape:
    kind: str
    attributes: tuple[str, ...] = ()
    children: tuple[Shape, ...] = ()


@dataclass(frozen=True, slots=True)
class Fact:
    kind: str
    value: str


@dataclass(frozen=True, slots=True)
class VisibleUnit:
    ordinal: int
    kind: str
    text: str
    inline_codes: tuple[str, ...]
    facts: tuple[Fact, ...]
    standalone_source_link: bool


@dataclass(frozen=True, slots=True)
class CloneSurface:
    ordinal: int
    kind: str
    text: str
    standalone_source_title: bool = False


@dataclass(frozen=True, slots=True)
class Destination:
    ordinal: int
    kind: str
    value: str
    base: str
    comparison_base: str
    normalized_path: str
    query: str | None
    fragment: str | None


@dataclass(frozen=True, slots=True)
class Anchor:
    ordinal: int
    values: tuple[str, ...]
    signature: AnchorSignature


@dataclass(frozen=True, slots=True)
class BlockCode:
    ordinal: int
    pre_text: str
    code_text: str | None
    semantic_classes: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class PageModel:
    path: str
    shape: tuple[Shape, ...]
    visible_units: tuple[VisibleUnit, ...]
    clone_surfaces: tuple[CloneSurface, ...]
    destinations: tuple[Destination, ...]
    anchors: tuple[Anchor, ...]
    anchor_index: Mapping[str, tuple[Anchor, ...]]
    block_codes: tuple[BlockCode, ...]
    visible_text: str
    policy_text_units: tuple[str, ...]
    policy_values: tuple[str, ...]
    duplicate_ids: tuple[str, ...]
    dom_node_count: int

    @property
    def anchor_shapes(self) -> tuple[AnchorSignature, ...]:
        return tuple(anchor.signature for anchor in self.anchors)

    def target_for_fragment(self, fragment: str) -> AnchorSignature | None:
        matches = self.anchor_index.get(fragment, ())
        return matches[0].signature if len(matches) == 1 else None


@dataclass(frozen=True, slots=True)
class ParsedPage:
    path: str
    metadata: FrozenValue | None
    body: str | None
    model: PageModel | None
    has_yaml_frontmatter: bool


@dataclass(frozen=True, slots=True)
class _RawTextNode:
    value: str
    context: Element | None
    source: Element | None
    top_level: bool
    kind: str = "text"


@dataclass(frozen=True, slots=True)
class _RawDestination:
    element: Element
    attribute: str
    value: str
    descriptor: str = ""


@dataclass(frozen=True, slots=True)
class _RawCodeText:
    pre: Element
    code: Element | None
    pre_text: str
    code_text: str | None


@dataclass(frozen=True, slots=True)
class _RawDomEvidence:
    text_nodes: tuple[_RawTextNode, ...]
    ids: tuple[tuple[Element, str], ...]
    destinations: tuple[_RawDestination, ...]
    code_blocks: tuple[_RawCodeText, ...]


class FrontmatterProblem(ValueError):
    def __init__(self, rule_id: str, message: str, line: int | None = None):
        super().__init__(message)
        self.rule_id = rule_id
        self.line = line


class InventoryProblem(ValueError):
    def __init__(self, rule_id: str, path: str, message: str):
        super().__init__(message)
        self.rule_id = rule_id
        self.path = path


class SourceReadProblem(ValueError):
    def __init__(self, rule_id: str, message: str):
        super().__init__(message)
        self.rule_id = rule_id


class SiteCrawlProblem(ValueError):
    def __init__(self, rule_id: str, message: str):
        super().__init__(message)
        self.rule_id = rule_id


class BoundedSafeLoader(yaml.SafeLoader):
    """SafeLoader with construction, alias, depth, and key bounds."""

    yaml_implicit_resolvers = {
        key: list(resolvers) for key, resolvers in yaml.SafeLoader.yaml_implicit_resolvers.items()
    }
    for _resolver_key, _resolvers in list(yaml_implicit_resolvers.items()):
        yaml_implicit_resolvers[_resolver_key] = [
            item for item in _resolvers if item[0] != "tag:yaml.org,2002:timestamp"
        ]

    def __init__(self, stream: str):
        super().__init__(stream)
        self.alias_count = 0
        self.composed_count = 0
        self.compose_depth = 0
        self.active_anchors: set[str] = set()

    def compose_node(self, parent: Any, index: Any) -> Any:
        event = self.peek_event()
        tracked_anchor: str | None = None
        if self.check_event(AliasEvent):
            self.alias_count += 1
            if event.anchor in self.active_anchors:
                raise FrontmatterProblem(
                    "frontmatter/recursive-alias",
                    "recursive YAML aliases are not allowed",
                    event.start_mark.line + 2,
                )
            if self.alias_count > MAX_YAML_ALIASES:
                raise FrontmatterProblem(
                    "frontmatter/alias-limit",
                    f"YAML alias count exceeds {MAX_YAML_ALIASES}",
                    event.start_mark.line + 2,
                )
        else:
            candidate = getattr(event, "anchor", None)
            if candidate is not None and candidate not in self.active_anchors:
                tracked_anchor = candidate
                self.active_anchors.add(candidate)
        self.composed_count += 1
        if self.composed_count > MAX_YAML_NODES:
            event = self.peek_event()
            raise FrontmatterProblem(
                "frontmatter/node-limit",
                f"YAML node count exceeds {MAX_YAML_NODES}",
                event.start_mark.line + 2,
            )
        self.compose_depth += 1
        if self.compose_depth > MAX_YAML_DEPTH:
            event = self.peek_event()
            raise FrontmatterProblem(
                "frontmatter/depth-limit",
                f"YAML nesting depth exceeds {MAX_YAML_DEPTH}",
                event.start_mark.line + 2,
            )
        try:
            return super().compose_node(parent, index)
        finally:
            self.compose_depth -= 1
            if tracked_anchor is not None:
                self.active_anchors.remove(tracked_anchor)

    def construct_mapping(self, node: MappingNode, deep: bool = False) -> dict[str, Any]:
        if not isinstance(node, MappingNode):
            raise ConstructorError(None, None, "expected a mapping node", node.start_mark)
        if any(
            key_node.tag == "tag:yaml.org,2002:merge"
            for key_node, _value_node in node.value
        ):
            raise FrontmatterProblem(
                "frontmatter/alias-limit",
                "YAML merge keys are not allowed in bounded frontmatter",
                node.start_mark.line + 2,
            )
        self.flatten_mapping(node)
        mapping: dict[str, Any] = {}
        for key_node, value_node in node.value:
            key = self.construct_object(key_node, deep=deep)
            if not isinstance(key, str):
                raise FrontmatterProblem(
                    "frontmatter/invalid-type",
                    "frontmatter mapping keys must be strings",
                    key_node.start_mark.line + 2,
                )
            if key in mapping:
                raise FrontmatterProblem(
                    "frontmatter/duplicate-key",
                    f"duplicate frontmatter key {key!r}",
                    key_node.start_mark.line + 2,
                )
            mapping[key] = self.construct_object(value_node, deep=deep)
        return mapping


def _reject_explicit_timestamp(loader: BoundedSafeLoader, node: Any) -> str:
    raise FrontmatterProblem(
        "frontmatter/invalid-type",
        "explicit YAML timestamp tags are not allowed; use a YYYY-MM-DD string",
        node.start_mark.line + 2,
    )


BoundedSafeLoader.add_constructor(
    "tag:yaml.org,2002:timestamp", _reject_explicit_timestamp
)


class _IssueCollector:
    def __init__(self) -> None:
        self._issues: list[Issue] = []
        self._overflowed = False

    def add(
        self,
        rule_id: str,
        path: str,
        message: str,
        *,
        paired_path: str | None = None,
        source_line: int | None = None,
        rendered_ordinal: int | None = None,
        excerpt: str | None = None,
    ) -> None:
        if len(self._issues) >= MAX_DIAGNOSTICS:
            self._overflowed = True
            return
        self._issues.append(
            Issue(
                rule_id=rule_id,
                path=_bounded_path(path),
                message=_bounded_message(message),
                paired_path=_bounded_path(paired_path) if paired_path else None,
                source_line=source_line,
                rendered_ordinal=rendered_ordinal,
                excerpt=_bounded_excerpt(excerpt) if excerpt else None,
            )
        )

    def finish(self) -> tuple[Issue, ...]:
        issues = list(self._issues)
        if self._overflowed:
            issues.append(
                Issue(
                    rule_id="diagnostics/limit",
                    path="docs/",
                    message=f"diagnostics were truncated at {MAX_DIAGNOSTICS}",
                )
            )
        return tuple(sorted(issues, key=Issue.sort_key))


def _escape_control_characters(value: str) -> str:
    escaped: list[str] = []
    for character in value:
        if unicodedata.category(character) not in {
            "Cc",
            "Cf",
            "Cn",
            "Co",
            "Cs",
            "Zl",
            "Zp",
        }:
            escaped.append(character)
            continue
        codepoint = ord(character)
        named = {"\n": r"\n", "\r": r"\r", "\t": r"\t"}.get(character)
        if named is not None:
            escaped.append(named)
        elif codepoint <= 0xFF:
            escaped.append(f"\\x{codepoint:02x}")
        elif codepoint <= 0xFFFF:
            escaped.append(f"\\u{codepoint:04x}")
        else:
            escaped.append(f"\\U{codepoint:08x}")
    return "".join(escaped)


def _bounded_text(value: str, limit: int, *, collapse_whitespace: bool) -> str:
    normalized = _escape_control_characters(value)
    if collapse_whitespace:
        normalized = re.sub(r"\s+", " ", normalized).strip()
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[: limit - 1]}…"


def _bounded_path(value: str) -> str:
    return _bounded_text(value, MAX_PATH, collapse_whitespace=False)


def _bounded_message(value: str) -> str:
    return _bounded_text(value, MAX_MESSAGE, collapse_whitespace=True)


def _bounded_excerpt(value: str | None) -> str | None:
    if value is None:
        return None
    return _bounded_text(value, MAX_EXCERPT, collapse_whitespace=True)


def _normalize_line_endings(value: str) -> str:
    return value.replace("\r\n", "\n").replace("\r", "\n")


def _freeze_config(value: Any) -> FrozenValue:
    if isinstance(value, Mapping):
        return tuple((str(key), _freeze_config(item)) for key, item in sorted(value.items(), key=lambda i: str(i[0])))
    if isinstance(value, (list, tuple)):
        return tuple(_freeze_config(item) for item in value)
    if value is None or isinstance(value, (str, bool, int, float)):
        return value
    raise TypeError(f"unsupported configuration value type {type(value).__name__}")


def _thaw_config(value: FrozenValue) -> Any:
    if isinstance(value, tuple):
        if all(
            isinstance(item, tuple) and len(item) == 2 and isinstance(item[0], str)
            for item in value
        ):
            return {item[0]: _thaw_config(item[1]) for item in value}
        return [_thaw_config(item) for item in value]
    return value


def _mapping_value(mapping: Any, key: str, default: Any = None) -> Any:
    if isinstance(mapping, Mapping):
        return mapping.get(key, default)
    try:
        return mapping[key]
    except (KeyError, TypeError):
        return default


def load_renderer_profile(
    config_path: str | Path = DEFAULT_CONFIG_PATH,
) -> tuple[RendererProfile | None, tuple[Issue, ...]]:
    """Load and verify the exact renderer/i18n profile used by this checker."""

    collector = _IssueCollector()
    path = Path(config_path).resolve()
    try:
        config = load_config(config_file=str(path))
        config = config.plugins.on_config(config)
    except Exception as error:
        collector.add(
            "config/load-failed",
            path.name,
            f"could not load MkDocs configuration: {type(error).__name__}: {error}",
        )
        return None, collector.finish()

    if MARKDOWN_SUFFIXES != EXPECTED_MARKDOWN_SUFFIXES:
        collector.add(
            "config/unsupported-renderer-profile",
            path.name,
            f"MkDocs Markdown suffixes drifted from the approved profile: {MARKDOWN_SUFFIXES!r}",
        )

    actual_extensions = tuple(str(item) for item in config.markdown_extensions)
    try:
        actual_mdx_configs = _freeze_config(dict(config.mdx_configs or {}))
    except Exception as error:
        collector.add(
            "config/unsupported-renderer-profile",
            path.name,
            f"Markdown extension configuration cannot be fingerprinted: {error}",
        )
        actual_mdx_configs = ()

    if actual_extensions != EXPECTED_MARKDOWN_EXTENSIONS:
        collector.add(
            "config/unsupported-renderer-profile",
            path.name,
            "active markdown_extensions differ from the approved rendered-DOM profile",
            excerpt=repr(actual_extensions),
        )
    if actual_mdx_configs != EXPECTED_MDX_CONFIGS:
        collector.add(
            "config/unsupported-renderer-profile",
            path.name,
            "active mdx_configs differ from the approved rendered-DOM profile",
            excerpt=repr(actual_mdx_configs),
        )

    actual_plugins = tuple(
        (name, type(plugin).__module__, type(plugin).__name__)
        for name, plugin in config.plugins.items()
    )
    if actual_plugins != EXPECTED_PLUGINS:
        collector.add(
            "config/unsupported-renderer-profile",
            path.name,
            "active plugins differ from the approved non-content-mutating profile",
            excerpt=repr(actual_plugins),
        )

    i18n = config.plugins.get("i18n")
    default_locale: str | None = None
    nondefault_locales: tuple[str, ...] = ()
    if i18n is None:
        collector.add(
            "config/unsupported-i18n-layout",
            path.name,
            "the approved mkdocs-static-i18n plugin is not active",
        )
    else:
        plugin_config = i18n.config
        structure = _mapping_value(plugin_config, "docs_structure")
        if structure != "suffix":
            collector.add(
                "config/unsupported-i18n-layout",
                path.name,
                f"only mkdocs-static-i18n suffix layout is supported, not {structure!r}",
            )

        language_records = tuple(_mapping_value(plugin_config, "languages", ()) or ())
        enabled = [record for record in language_records if _mapping_value(record, "build", True)]
        defaults = [record for record in enabled if _mapping_value(record, "default", False)]
        if len(defaults) != 1:
            collector.add(
                "config/unsupported-i18n-layout",
                path.name,
                f"exactly one enabled default locale is required; found {len(defaults)}",
            )
        else:
            default_locale = str(_mapping_value(defaults[0], "locale", ""))
        locale_values = [str(_mapping_value(record, "locale", "")) for record in enabled]
        if any(not locale or "/" in locale or "\\" in locale for locale in locale_values):
            collector.add(
                "config/unsupported-i18n-layout",
                path.name,
                "enabled locale names must be nonempty filename-safe suffixes",
            )
        if len(locale_values) != len(set(locale_values)):
            collector.add(
                "config/unsupported-i18n-layout",
                path.name,
                "enabled locale names must be unique",
            )
        if default_locale is not None:
            nondefault_locales = tuple(locale for locale in locale_values if locale != default_locale)
        if not nondefault_locales:
            collector.add(
                "config/unsupported-i18n-layout",
                path.name,
                "at least one enabled non-default locale is required",
            )

        try:
            admonition_translations = tuple(
                (
                    str(_mapping_value(record, "locale", "")),
                    _freeze_config(
                        _mapping_value(record, "admonition_translations")
                    ),
                )
                for record in enabled
            )
            i18n_fingerprint = (
                structure,
                _mapping_value(plugin_config, "build_only_locale"),
                _mapping_value(plugin_config, "fallback_to_default"),
                _mapping_value(plugin_config, "reconfigure_material"),
                _mapping_value(plugin_config, "reconfigure_search"),
                default_locale,
                nondefault_locales,
                admonition_translations,
            )
        except Exception as error:
            collector.add(
                "config/unsupported-renderer-profile",
                path.name,
                "active i18n settings cannot be fingerprinted: "
                f"{type(error).__name__}: {error}",
            )
            i18n_fingerprint = None
        expected_i18n = (
            "suffix",
            None,
            False,
            True,
            True,
            EXPECTED_DEFAULT_LOCALE,
            EXPECTED_NONDEFAULT_LOCALES,
            (("en", None), ("zh-TW", None)),
        )
        if i18n_fingerprint is not None and i18n_fingerprint != expected_i18n:
            collector.add(
                "config/unsupported-renderer-profile",
                path.name,
                "active i18n locales or content-affecting settings differ from the approved profile",
                excerpt=repr(i18n_fingerprint),
            )

    issues = collector.finish()
    if issues or default_locale is None:
        return None, issues
    return (
        RendererProfile(
            config_path=path,
            docs_dir=Path(os.path.abspath(os.fspath(config.docs_dir))),
            default_locale=default_locale,
            nondefault_locales=nondefault_locales,
            markdown_extensions=actual_extensions,
            mdx_configs=actual_mdx_configs if isinstance(actual_mdx_configs, tuple) else (),
        ),
        (),
    )


def _load_yaml_mapping(source: str) -> tuple[FrozenValue, Mapping[str, Any]]:
    if len(source.encode("utf-8")) > MAX_FRONTMATTER_BYTES:
        raise FrontmatterProblem(
            "frontmatter/too-large",
            f"YAML frontmatter exceeds {MAX_FRONTMATTER_BYTES} bytes",
            1,
        )
    if source.count("\n") + 1 > MAX_METADATA_LINES:
        raise FrontmatterProblem(
            "frontmatter/node-limit",
            f"YAML frontmatter exceeds {MAX_METADATA_LINES} source lines",
            1,
        )

    loader: BoundedSafeLoader | None = None
    try:
        loader = BoundedSafeLoader(source)
        value = loader.get_single_data()
    except FrontmatterProblem:
        raise
    except ConstructorError as error:
        problem = getattr(error, "problem", None) or "invalid YAML tag or value"
        rule = (
            "frontmatter/unknown-tag"
            if "could not determine a constructor" in str(error)
            else "frontmatter/invalid-yaml"
        )
        line = error.problem_mark.line + 2 if error.problem_mark is not None else None
        raise FrontmatterProblem(rule, problem, line) from error
    except (yaml.YAMLError, ComposerError) as error:
        problem = getattr(error, "problem", None) or str(error).splitlines()[0]
        mark = getattr(error, "problem_mark", None)
        line = mark.line + 2 if mark is not None else None
        raise FrontmatterProblem("frontmatter/invalid-yaml", problem, line) from error
    except Exception as error:
        raise FrontmatterProblem(
            "frontmatter/invalid-yaml",
            f"unexpected YAML construction failure: {type(error).__name__}: {error}",
        ) from error
    finally:
        if loader is not None:
            try:
                loader.dispose()
            except Exception:
                # Disposal cannot make a previously bounded parse escape.
                pass

    if not isinstance(value, Mapping):
        raise FrontmatterProblem(
            "frontmatter/nonmapping",
            "YAML frontmatter root must be a mapping",
            1,
        )
    try:
        state = {"expanded": 0}
        frozen = _freeze_metadata(value, active=set(), depth=0, state=state)
    except FrontmatterProblem:
        raise
    except Exception as error:
        raise FrontmatterProblem(
            "frontmatter/invalid-yaml",
            f"unexpected YAML value conversion failure: {type(error).__name__}: {error}",
        ) from error
    return frozen, value


def _freeze_metadata(
    value: Any,
    *,
    active: set[int],
    depth: int,
    state: dict[str, int],
) -> FrozenValue:
    if depth > MAX_YAML_DEPTH:
        raise FrontmatterProblem(
            "frontmatter/depth-limit",
            f"expanded YAML nesting exceeds {MAX_YAML_DEPTH}",
        )
    state["expanded"] += 1
    if state["expanded"] > MAX_YAML_EXPANDED_NODES:
        raise FrontmatterProblem(
            "frontmatter/alias-limit",
            f"expanded YAML node count exceeds {MAX_YAML_EXPANDED_NODES}",
        )

    if value is None:
        return ("scalar:null",)
    if isinstance(value, str):
        return ("scalar:string", value)
    if isinstance(value, bool):
        return ("scalar:boolean", value)
    if isinstance(value, int):
        return ("scalar:integer", value)
    if isinstance(value, float):
        if not math.isfinite(value):
            raise FrontmatterProblem(
                "frontmatter/invalid-type", "frontmatter numbers must be finite"
            )
        return ("scalar:float", value)
    if not isinstance(value, (Mapping, list)):
        raise FrontmatterProblem(
            "frontmatter/invalid-type",
            f"unsupported frontmatter value type {type(value).__name__}",
        )

    identity = id(value)
    if identity in active:
        raise FrontmatterProblem(
            "frontmatter/recursive-alias", "recursive YAML aliases are not allowed"
        )
    active.add(identity)
    try:
        if isinstance(value, Mapping):
            items: list[tuple[str, FrozenValue]] = []
            for key, item in value.items():
                if not isinstance(key, str):
                    raise FrontmatterProblem(
                        "frontmatter/invalid-type",
                        "frontmatter mapping keys must be strings",
                    )
                items.append(
                    (
                        key,
                        _freeze_metadata(
                            item, active=active, depth=depth + 1, state=state
                        ),
                    )
                )
            return ("mapping", tuple(sorted(items, key=lambda item: item[0])))
        return (
            "sequence",
            tuple(
                _freeze_metadata(item, active=active, depth=depth + 1, state=state)
                for item in value
            ),
        )
    finally:
        active.remove(identity)


def _bound_multimarkdown_metadata(source: str) -> None:
    metadata_lines = 0
    metadata_bytes = 0
    active_key = False
    for line_number, line in enumerate(source.split("\n"), start=1):
        if not line.strip():
            break
        if mkdocs_meta.META_RE.match(line):
            active_key = True
        elif active_key and mkdocs_meta.META_MORE_RE.match(line):
            pass
        else:
            break
        metadata_lines += 1
        metadata_bytes += len(line.encode("utf-8")) + 1
        if metadata_lines > MAX_METADATA_LINES:
            raise FrontmatterProblem(
                "frontmatter/node-limit",
                f"MultiMarkdown metadata exceeds {MAX_METADATA_LINES} source lines",
                line_number,
            )
        if metadata_bytes > MAX_FRONTMATTER_BYTES:
            raise FrontmatterProblem(
                "frontmatter/too-large",
                f"MultiMarkdown metadata exceeds {MAX_FRONTMATTER_BYTES} bytes",
                line_number,
            )


def _split_frontmatter(
    path: str, text: str, collector: _IssueCollector
) -> tuple[str | None, FrozenValue | None, Mapping[str, Any] | None, bool]:
    normalized = _normalize_line_endings(text)
    yaml_match = mkdocs_meta.YAML_RE.match(normalized)
    looks_like_yaml = re.match(r"^---[ \t]*(?:\n|$)", normalized) is not None

    if looks_like_yaml and yaml_match is None:
        collector.add(
            "frontmatter/malformed",
            path,
            "frontmatter opener has no MkDocs-compatible closing --- or ... delimiter",
            source_line=1,
        )
        return None, None, None, True

    if yaml_match is not None:
        source = yaml_match.group(1)
        try:
            frozen, mapping = _load_yaml_mapping(source)
        except FrontmatterProblem as error:
            collector.add(
                error.rule_id,
                path,
                str(error),
                source_line=error.line,
            )
            return None, None, None, True
        # This is MkDocs get_data's exact successful YAML body operation. Avoid
        # invoking its unbounded second SafeLoader after our bounded parse.
        body = normalized[yaml_match.end() :].lstrip("\n")
        return body, frozen, mapping, True

    try:
        _bound_multimarkdown_metadata(normalized)
        body, metadata = mkdocs_meta.get_data(normalized)
        frozen = _freeze_metadata(
            metadata, active=set(), depth=0, state={"expanded": 0}
        )
    except FrontmatterProblem as error:
        collector.add(error.rule_id, path, str(error), source_line=error.line)
        return None, None, None, False
    except Exception as error:
        collector.add(
            "frontmatter/invalid-yaml",
            path,
            "MkDocs metadata parsing failed deterministically: "
            f"{type(error).__name__}: {error}",
        )
        return None, None, None, False
    return body, frozen, metadata, False


def _is_valid_http_url(value: str) -> bool:
    if (
        "\\" in value
        or any(
            character.isspace()
            or unicodedata.category(character) in {"Cc", "Cf", "Cs", "Co", "Cn"}
            for character in value
        )
        or re.search(r"%(?![0-9A-Fa-f]{2})", value) is not None
    ):
        return False
    try:
        parsed = urllib.parse.urlsplit(value)
        _ = parsed.port
    except ValueError:
        return False
    authority = parsed.netloc.rsplit("@", 1)[-1]
    return (
        parsed.scheme in {"http", "https"}
        and parsed.hostname not in {None, ""}
        and not authority.endswith(":")
    )


def _validate_note_metadata(
    path: str,
    metadata: Mapping[str, Any] | None,
    has_yaml: bool,
    collector: _IssueCollector,
) -> None:
    if not has_yaml:
        collector.add(
            "metadata/missing-frontmatter",
            path,
            "English notes pages must begin with YAML frontmatter",
            source_line=1,
        )
        return
    if metadata is None:
        return

    for key in NOTE_KEYS:
        if key not in metadata:
            collector.add(
                "metadata/missing-key",
                path,
                f"notes frontmatter is missing required key {key!r}",
                source_line=1,
            )

    for key in ("kind", "status", "as_of", "last_verified", "confidence"):
        if key in metadata and (
            not isinstance(metadata[key], str) or not metadata[key].strip()
        ):
            collector.add(
                "metadata/invalid-string",
                path,
                f"notes frontmatter key {key!r} must be a nonempty string",
                source_line=1,
            )

    if metadata.get("status") != "reviewed":
        collector.add(
            "metadata/status",
            path,
            "notes frontmatter key 'status' must equal 'reviewed'",
            source_line=1,
        )

    for key in ("as_of", "last_verified"):
        value = metadata.get(key)
        valid = isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value)
        if valid:
            try:
                dt.date.fromisoformat(value)
            except ValueError:
                valid = False
        if not valid:
            collector.add(
                "metadata/date",
                path,
                f"notes frontmatter key {key!r} must be a real YYYY-MM-DD date string",
                source_line=1,
            )

    upstreams = metadata.get("upstreams")
    if not isinstance(upstreams, list) or not upstreams:
        collector.add(
            "metadata/upstreams",
            path,
            "notes frontmatter key 'upstreams' must be a nonempty YAML list",
            source_line=1,
        )
        return
    for index, upstream in enumerate(upstreams, start=1):
        if not isinstance(upstream, str) or not upstream.strip():
            collector.add(
                "metadata/url",
                path,
                f"upstream {index} must be a nonempty HTTP(S) URL string",
                source_line=1,
            )
            continue
        if not _is_valid_http_url(upstream):
            collector.add(
                "metadata/url",
                path,
                f"upstream {index} is not a valid HTTP(S) URL",
                source_line=1,
                excerpt=upstream,
            )


def _tag(element: Element) -> str:
    if not isinstance(element.tag, str):
        return "#comment"
    tag = element.tag
    if tag.startswith("{") and "}" in tag:
        tag = tag.split("}", 1)[1]
    elif ":" in tag:
        tag = tag.rsplit(":", 1)[1]
    return tag.lower()


def _attribute_local_name(name: str) -> str:
    if name.startswith("{") and "}" in name:
        name = name.split("}", 1)[1]
    elif ":" in name:
        name = name.rsplit(":", 1)[1]
    return name.lower()


def _resource_attribute_name(name: str) -> str:
    if name.startswith("{http://www.w3.org/1999/xlink}"):
        return f"xlink:{_attribute_local_name(name)}"
    return name if name in RESOURCE_ATTRIBUTES else _attribute_local_name(name)


def _classes(element: Element) -> tuple[str, ...]:
    return tuple(sorted(set(element.attrib.get("class", "").split())))


def _has_class(element: Element, value: str) -> bool:
    return value in _classes(element)


def _is_descendant_of_class(
    element: Element, value: str, parents: Mapping[Element, Element]
) -> bool:
    current: Element | None = element
    while current is not None:
        if _has_class(current, value):
            return True
        current = parents.get(current)
    return False


def _is_in_literal_or_inert_context(
    element: Element, parents: Mapping[Element, Element], *, include_self: bool = False
) -> bool:
    current: Element | None = element if include_self else parents.get(element)
    while current is not None:
        if _tag(current) in {"pre", "code", "script", "style", "template"}:
            return True
        current = parents.get(current)
    return False


def _is_in_inert_dom_context(
    element: Element,
    parents: Mapping[Element, Element],
    *,
    include_self: bool = False,
) -> bool:
    current: Element | None = element if include_self else parents.get(element)
    while current is not None:
        if _tag(current) in {"script", "style", "template"}:
            return True
        current = parents.get(current)
    return False


_VALID_DISPLAY_VALUES = {
    "none",
    "block",
    "inline",
    "inline-block",
    "flow-root",
    "list-item",
    "flex",
    "inline-flex",
    "grid",
    "inline-grid",
    "table",
    "inline-table",
    "table-row-group",
    "table-header-group",
    "table-footer-group",
    "table-row",
    "table-cell",
    "table-column-group",
    "table-column",
    "table-caption",
    "ruby",
    "ruby-base",
    "ruby-text",
    "contents",
    "initial",
    "inherit",
    "unset",
    "revert",
    "revert-layer",
}
_VALID_VISIBILITY_VALUES = {
    "visible",
    "hidden",
    "collapse",
    "initial",
    "inherit",
    "unset",
    "revert",
    "revert-layer",
}
_VALID_TEXT_ALIGN_VALUES = {
    "left",
    "right",
    "center",
    "justify",
    "start",
    "end",
    "match-parent",
    "justify-all",
    "initial",
    "inherit",
    "unset",
    "revert",
    "revert-layer",
}


def _winning_inline_style(
    element: Element, property_name: str, valid_values: set[str]
) -> tuple[str, bool] | None:
    style = element.attrib.get("style", "")
    declarations: list[tuple[str, bool]] = []
    for match in re.finditer(
        rf"(?:^|;)\s*{re.escape(property_name)}\s*:\s*([^;]+)",
        style,
        re.IGNORECASE,
    ):
        value = match.group(1).strip().lower()
        important_match = re.search(r"\s*!important\s*$", value, re.IGNORECASE)
        important = important_match is not None
        if important_match is not None:
            value = value[: important_match.start()].strip()
        if value in valid_values:
            declarations.append((value, important))
    if not declarations:
        return None
    important_declarations = [item for item in declarations if item[1]]
    return (important_declarations or declarations)[-1]


def _normalized_html_integer(value: str | None) -> str | None:
    if value is None or re.fullmatch(r"[+-]?\d+", value.strip()) is None:
        return None
    return str(int(value.strip()))


def _has_nonoverridable_hidden_state(element: Element) -> bool:
    if "hidden" in element.attrib:
        return True
    if _tag(element) == "dialog" and "open" not in element.attrib:
        return True
    display = _winning_inline_style(element, "display", _VALID_DISPLAY_VALUES)
    return display is not None and display[0] == "none"


def _is_directly_hidden(element: Element) -> bool:
    if _has_nonoverridable_hidden_state(element):
        return True
    visibility = _winning_inline_style(
        element, "visibility", _VALID_VISIBILITY_VALUES
    )
    return visibility is not None and visibility[0] in {"hidden", "collapse"}


def _is_hidden_context(element: Element, parents: Mapping[Element, Element]) -> bool:
    current: Element | None = element
    inherited_visibility: str | None = None
    while current is not None:
        if _has_nonoverridable_hidden_state(current):
            return True
        if inherited_visibility is None:
            declaration = _winning_inline_style(
                current, "visibility", _VALID_VISIBILITY_VALUES
            )
            if declaration is not None:
                value = declaration[0]
                if value in {"hidden", "collapse", "visible", "initial"}:
                    inherited_visibility = value
                elif value in {"revert", "revert-layer"}:
                    # External cascade behavior is outside this checker; the
                    # browser initial visibility is visible.
                    inherited_visibility = "visible"
                # inherit/unset continue to the parent declaration.
        current = parents.get(current)
    return inherited_visibility in {"hidden", "collapse"}


def _is_generated_element(element: Element, parents: Mapping[Element, Element]) -> bool:
    classes = set(_classes(element))
    parent = parents.get(element)
    if (
        classes == {"headerlink"}
        and _tag(element) == "a"
        and parent is not None
        and re.fullmatch(r"h[1-6]", _tag(parent)) is not None
        and bool(parent.attrib.get("id"))
        and set(element.attrib) == {"class", "href", "title"}
        and element.attrib.get("href") == f"#{parent.attrib['id']}"
        and element.attrib.get("title") == "Permanent link"
        and len(element) == 0
        and element.text == "¶"
    ):
        return True
    if (
        classes == {"footnote-backref"}
        and _tag(element) == "a"
        and set(element.attrib) == {"class", "href", "title"}
        and re.fullmatch(r"#fnref\d*:.+", element.attrib.get("href", "")) is not None
        and element.attrib.get("title", "").startswith("Jump back to footnote ")
        and len(element) == 0
        and element.text == "↩"
        and _is_descendant_of_class(element, "footnote", parents)
    ):
        return True
    return False


TRANSPARENT_INLINE_TAGS = {
    "abbr",
    "b",
    "bdi",
    "bdo",
    "cite",
    "em",
    "i",
    "mark",
    "q",
    "s",
    "small",
    "span",
    "strike",
    "strong",
    "time",
    "u",
    "var",
}
CONTAINER_KINDS = {
    "blockquote",
    "definition-list",
    "table",
    "table-head",
    "table-body",
    "table-foot",
    "table-row",
    "list:ordered",
    "list:unordered",
    "admonition",
    "details",
    "tabs",
    "tab",
    "card-grid",
    "footnotes",
}
NON_PROSE_KINDS = {
    "code-block",
    "raw:script",
    "raw:style",
    "raw:template",
    "thematic-break",
    "hard-break",
    "image",
    "link",
}
SOURCE_SECTION_TITLES = frozenset(
    {
        "source",
        "sources",
        "reference",
        "references",
        "primary sources",
        "further reading",
        "來源",
        "主要來源",
        "參考",
        "參考資料",
        "延伸閱讀",
    }
)


class _DomModelBuilder:
    def __init__(self, path: str, fragment: Element):
        self.path = path
        self.fragment = fragment
        self.parents: dict[Element, Element] = {
            child: parent for parent in fragment.iter() for child in parent
        }
        self.owner_info: dict[Element, tuple[str, int]] = {}
        self._next_shape_ordinal = 1
        self.generated_elements: set[Element] = set()
        self.canonical_highlights: dict[Element, Element] = {}
        self.canonical_tabs: set[Element] = set()
        self.lineno_pre_elements: set[Element] = set()
        self.code_filename_elements: set[Element] = set()

    def build(self) -> PageModel:
        # Capture all raw browser-facing evidence before classifying any
        # renderer-owned UI. Later filters can only remove exact scaffolds.
        evidence = self._collect_raw_dom_evidence()
        self._classify_generated_ui()
        shape = self._document_shape()
        visible_units = self._visible_units()
        clone_surfaces = self._clone_surfaces()
        destinations = self._destinations(evidence.destinations)
        anchors, anchor_index, duplicates = self._anchors(evidence.ids)
        block_codes = self._block_codes(evidence.code_blocks)
        policy_text_units = self._policy_text_units(evidence.text_nodes)
        visible_text = "\n".join(policy_text_units)
        policy_values = self._policy_values(visible_text)
        return PageModel(
            path=self.path,
            shape=shape,
            visible_units=visible_units,
            clone_surfaces=clone_surfaces,
            destinations=destinations,
            anchors=anchors,
            anchor_index=anchor_index,
            block_codes=block_codes,
            visible_text=visible_text,
            policy_text_units=policy_text_units,
            policy_values=policy_values,
            duplicate_ids=duplicates,
            dom_node_count=sum(1 for _ in self.fragment.iter()),
        )

    def _collect_raw_dom_evidence(self) -> _RawDomEvidence:
        text_nodes: list[_RawTextNode] = []
        ids: list[tuple[Element, str]] = []
        destinations: list[_RawDestination] = []
        code_blocks: list[_RawCodeText] = []

        for element in self.fragment.iter():
            if element is self.fragment or _tag(element) == "#comment":
                continue
            if "id" in element.attrib:
                ids.append((element, element.attrib["id"]))
            if _tag(element) == "pre":
                code = next(
                    (item for item in element.iter() if _tag(item) == "code"),
                    None,
                )
                code_blocks.append(
                    _RawCodeText(
                        element,
                        code,
                        "".join(element.itertext()),
                        "".join(code.itertext()) if code is not None else None,
                    )
                )
            for local_attribute in RESOURCE_ATTRIBUTES:
                matching_attributes = sorted(
                    (name, value)
                    for name, value in element.attrib.items()
                    if _attribute_local_name(name) == local_attribute
                )
                for attribute, value in matching_attributes:
                    resource_name = _resource_attribute_name(attribute)
                    if local_attribute == "srcset":
                        for candidate, descriptor in _parse_srcset_candidates(value):
                            destinations.append(
                                _RawDestination(
                                    element, resource_name, candidate, descriptor
                                )
                            )
                    else:
                        destinations.append(
                            _RawDestination(element, resource_name, value)
                        )
                    if len(destinations) > MAX_RESOURCE_DESTINATIONS:
                        raise ValueError(
                            "rendered resource destination count exceeds "
                            f"{MAX_RESOURCE_DESTINATIONS}"
                        )

        def visit(container: Element) -> None:
            top_level = container is self.fragment
            context = None if top_level else container
            if container.text:
                text_nodes.append(
                    _RawTextNode(
                        container.text,
                        context,
                        None if top_level else container,
                        top_level,
                    )
                )
            for child in container:
                if _tag(child) != "#comment":
                    if _tag(child) == "img" and "alt" in child.attrib:
                        text_nodes.append(
                            _RawTextNode(
                                child.attrib["alt"], child, child, False, "image-alt"
                            )
                        )
                    visit(child)
                if child.tail:
                    text_nodes.append(
                        _RawTextNode(
                            child.tail,
                            context,
                            None if top_level else container,
                            top_level,
                        )
                    )

        visit(self.fragment)
        return _RawDomEvidence(
            tuple(text_nodes), tuple(ids), tuple(destinations), tuple(code_blocks)
        )

    @staticmethod
    def _direct_text_is_whitespace(element: Element) -> bool:
        return not (element.text or "").strip() and all(
            not (child.tail or "").strip() for child in element
        )

    @staticmethod
    def _empty_scaffold_span(element: Element) -> bool:
        return (
            _tag(element) == "span"
            and not element.attrib
            and len(element) == 0
            and not (element.text or "").strip()
            and not (element.tail or "").strip()
        )

    def _canonical_code_pre(self, pre: Element) -> Element | None:
        children = list(pre)
        if (
            _tag(pre) != "pre"
            or pre.attrib
            or not self._direct_text_is_whitespace(pre)
            or len(children) != 2
            or not self._empty_scaffold_span(children[0])
            or _tag(children[1]) != "code"
            or children[1].attrib
        ):
            return None
        return children[1]

    @staticmethod
    def _filename_leaf(element: Element) -> bool:
        return (
            _tag(element) in {"span", "th"}
            and set(_classes(element)) == {"filename"}
            and set(element.attrib) <= {"class", "colspan"}
            and len(element) == 0
        )

    @staticmethod
    def _canonical_code_anchor(element: Element) -> bool:
        if _tag(element) != "a":
            return False
        element_id = element.attrib.get("id", "")
        name = element.attrib.get("name", "")
        href = element.attrib.get("href")
        allowed = {"id", "name"} | ({"href"} if href is not None else set())
        return (
            bool(re.fullmatch(r"__codelineno-\d+-\d+", element_id))
            and name == element_id
            and set(element.attrib) == allowed
            and (href is None or href == f"#{element_id}")
            and not (element.text or "").strip()
            and len(element) == 0
        )

    def _canonical_plain_highlight(self, wrapper: Element) -> Element | None:
        children = list(wrapper)
        if len(children) == 2 and self._filename_leaf(children[0]):
            self.code_filename_elements.add(children[0])
            pre = children[1]
        elif len(children) == 1:
            pre = children[0]
        else:
            return None
        code = self._canonical_code_pre(pre)
        if code is None:
            return None
        for element in code.iter():
            if self._canonical_code_anchor(element):
                self.generated_elements.add(element)
        return pre

    def _canonical_linenos_highlight(self, wrapper: Element) -> Element | None:
        wrapper_children = list(wrapper)
        if len(wrapper_children) != 1:
            return None
        table = wrapper_children[0]
        if (
            _tag(table) != "table"
            or set(_classes(table)) != {"highlighttable"}
            or set(table.attrib) != {"class"}
            or not self._direct_text_is_whitespace(table)
        ):
            return None
        table_children = list(table)
        if (
            len(table_children) != 1
            or _tag(table_children[0]) != "tbody"
            or table_children[0].attrib
            or not self._direct_text_is_whitespace(table_children[0])
        ):
            return None
        tbody = table_children[0]
        rows = list(tbody)
        if len(rows) not in {1, 2} or any(
            _tag(row) != "tr"
            or row.attrib
            or not self._direct_text_is_whitespace(row)
            for row in rows
        ):
            return None
        data_row = rows[-1]
        if len(rows) == 2:
            filename_cells = list(rows[0])
            if len(filename_cells) != 1:
                return None
            filename_cell = filename_cells[0]
            filename_children = list(filename_cell)
            if (
                _tag(filename_cell) != "th"
                or set(_classes(filename_cell)) != {"filename"}
                or filename_cell.attrib.get("colspan") != "2"
                or set(filename_cell.attrib) != {"class", "colspan"}
                or not self._direct_text_is_whitespace(filename_cell)
                or len(filename_children) != 1
                or not self._filename_leaf(filename_children[0])
            ):
                return None
            self.code_filename_elements.add(filename_children[0])

        cells = list(data_row)
        if len(cells) != 2:
            return None
        linenos_cell, code_cell = cells
        if (
            _tag(linenos_cell) != "td"
            or set(_classes(linenos_cell)) != {"linenos"}
            or set(linenos_cell.attrib) != {"class"}
            or not self._direct_text_is_whitespace(linenos_cell)
            or _tag(code_cell) != "td"
            or set(_classes(code_cell)) != {"code"}
            or set(code_cell.attrib) != {"class"}
            or not self._direct_text_is_whitespace(code_cell)
        ):
            return None

        line_divs = list(linenos_cell)
        if (
            len(line_divs) != 1
            or _tag(line_divs[0]) != "div"
            or set(_classes(line_divs[0])) != {"linenodiv"}
            or set(line_divs[0].attrib) != {"class"}
            or not self._direct_text_is_whitespace(line_divs[0])
            or len(line_divs[0]) != 1
        ):
            return None
        line_pre = line_divs[0][0]
        line_children = list(line_pre)
        if (
            _tag(line_pre) != "pre"
            or line_pre.attrib
            or not self._direct_text_is_whitespace(line_pre)
            or not line_children
            or not self._empty_scaffold_span(line_children[0])
        ):
            return None
        line_ids: list[str] = []
        for line in line_children[1:]:
            links = list(line)
            if (
                _tag(line) != "span"
                or set(_classes(line)) not in ({"normal"}, {"special"})
                or set(line.attrib) != {"class"}
                or not self._direct_text_is_whitespace(line)
                or len(links) != 1
                or _tag(links[0]) != "a"
                or set(links[0].attrib) != {"href"}
                or re.fullmatch(
                    r"#__codelineno-\d+-\d+", links[0].attrib.get("href", "")
                )
                is None
                or len(links[0]) != 0
                or not (links[0].text or "").isdigit()
            ):
                return None
            line_ids.append(links[0].attrib["href"][1:])

        code_divs = list(code_cell)
        if (
            len(code_divs) != 1
            or _tag(code_divs[0]) != "div"
            or code_divs[0].attrib
            or not self._direct_text_is_whitespace(code_divs[0])
            or len(code_divs[0]) != 1
        ):
            return None
        code_pre = code_divs[0][0]
        code = self._canonical_code_pre(code_pre)
        if code is None:
            return None
        code_anchors = [
            element
            for element in code.iter()
            if self._canonical_code_anchor(element)
        ]
        if [element.attrib["id"] for element in code_anchors] != line_ids:
            return None
        self.generated_elements.update(linenos_cell.iter())
        self.generated_elements.update(code_anchors)
        self.lineno_pre_elements.add(line_pre)
        return code_pre

    def _canonical_tab_wrapper(self, wrapper: Element) -> bool:
        if (
            set(_classes(wrapper)) != {"tabbed-set", "tabbed-alternate"}
            or set(wrapper.attrib) != {"class", "data-tabs"}
            or not self._direct_text_is_whitespace(wrapper)
        ):
            return False
        marker = re.fullmatch(r"(\d+):(\d+)", wrapper.attrib.get("data-tabs", ""))
        if marker is None:
            return False
        children = list(wrapper)
        inputs: list[Element] = []
        while children and _tag(children[0]) == "input":
            inputs.append(children.pop(0))
        if len(children) != 2 or not inputs:
            return False
        labels_container, content_container = children
        if (
            _tag(labels_container) != "div"
            or set(_classes(labels_container)) != {"tabbed-labels"}
            or set(labels_container.attrib) != {"class"}
            or not self._direct_text_is_whitespace(labels_container)
            or _tag(content_container) != "div"
            or set(_classes(content_container)) != {"tabbed-content"}
            or set(content_container.attrib) != {"class"}
            or not self._direct_text_is_whitespace(content_container)
        ):
            return False
        labels = list(labels_container)
        blocks = list(content_container)
        if not (len(inputs) == len(labels) == len(blocks) == int(marker.group(2))):
            return False
        tab_name = f"__tabbed_{marker.group(1)}"
        for index, (input_element, label, block) in enumerate(
            zip(inputs, labels, blocks), start=1
        ):
            allowed = {"id", "name", "type"}
            if index == 1:
                allowed.add("checked")
            expected_id = f"{tab_name}_{index}"
            if (
                set(input_element.attrib) != allowed
                or input_element.attrib.get("id") != expected_id
                or input_element.attrib.get("name") != tab_name
                or input_element.attrib.get("type") != "radio"
                or (index == 1 and input_element.attrib.get("checked") != "checked")
                or _tag(label) != "label"
                or set(label.attrib) != {"for"}
                or label.attrib.get("for") != expected_id
                or _tag(block) != "div"
                or set(_classes(block)) != {"tabbed-block"}
                or set(block.attrib) != {"class"}
            ):
                return False
        self.generated_elements.update(inputs)
        return True

    def _classify_generated_ui(self) -> None:
        for element in self.fragment.iter():
            if (
                _tag(element) == "div"
                and set(_classes(element)) == {"highlight"}
                and set(element.attrib) == {"class"}
                and self._direct_text_is_whitespace(element)
            ):
                pre = self._canonical_plain_highlight(element)
                if pre is None:
                    pre = self._canonical_linenos_highlight(element)
                if pre is not None:
                    self.canonical_highlights[element] = pre
            elif _tag(element) == "div" and self._canonical_tab_wrapper(element):
                self.canonical_tabs.add(element)

    def _is_generated(self, element: Element) -> bool:
        return element in self.generated_elements or _is_generated_element(
            element, self.parents
        )

    def _is_in_generated_context(self, element: Element | None) -> bool:
        current = element
        while current is not None:
            if self._is_generated(current):
                return True
            current = self.parents.get(current)
        return False

    def _document_shape(self) -> tuple[Shape, ...]:
        shapes: list[Shape] = []
        if _normalize_visible_text(self.fragment.text or ""):
            shapes.append(Shape("raw:text"))
        for child in self.fragment:
            shapes.extend(self._shape_element(child))
            if _normalize_visible_text(child.tail or ""):
                shapes.append(Shape("raw:text"))
        return tuple(shapes)

    def _claim(self, element: Element, kind: str) -> int:
        existing = self.owner_info.get(element)
        if existing is not None:
            return existing[1]
        ordinal = self._next_shape_ordinal
        self._next_shape_ordinal += 1
        self.owner_info[element] = (kind, ordinal)
        return ordinal

    def _shape_children(self, element: Element) -> tuple[Shape, ...]:
        return tuple(node for child in element for node in self._shape_element(child))

    def _code_descendant_shapes(self, code: Element | None) -> tuple[Shape, ...]:
        if code is None:
            return ()

        def content(element: Element) -> tuple[Shape, ...]:
            nodes: list[Shape] = []
            if element.text:
                nodes.append(Shape("code-text", (f"length={len(element.text)}",)))
            for child in element:
                nodes.extend(visit(child))
                if child.tail:
                    nodes.append(Shape("code-tail", (f"length={len(child.tail)}",)))
            return tuple(nodes)

        def visit(element: Element) -> tuple[Shape, ...]:
            if _tag(element) == "#comment":
                return ()
            attributes = tuple(
                f"{name}={value}" for name, value in sorted(element.attrib.items())
            )
            return (
                Shape(
                    f"code-descendant:{_tag(element)}",
                    attributes,
                    content(element),
                ),
            )

        return content(code)

    def _code_block_shape(self, pre: Element) -> Shape:
        code = next((item for item in pre.iter() if _tag(item) == "code"), None)
        return Shape(
            "code-block",
            children=self._code_descendant_shapes(code),
        )

    def _shape_element(self, element: Element) -> tuple[Shape, ...]:
        tag = _tag(element)
        if tag == "#comment" or self._is_generated(element):
            return ()
        shapes = self._shape_element_core(element)
        if not _is_directly_hidden(element):
            return shapes
        if element not in self.owner_info:
            self._claim(element, "visibility:hidden")
        return (Shape("visibility:hidden", children=shapes),)

    def _shape_element_core(self, element: Element) -> tuple[Shape, ...]:
        tag = _tag(element)
        classes = set(_classes(element))

        if tag in {"script", "style", "template"}:
            self._claim(element, f"raw:{tag}")
            return (Shape(f"raw:{tag}"),)

        if element in self.canonical_highlights:
            pre = self.canonical_highlights[element]
            ordinal = self._claim(element, "code-block")
            self.owner_info[pre] = ("code-block", ordinal)
            return (self._code_block_shape(pre),)

        if tag == "div" and "admonition" in classes:
            self._claim(element, "admonition")
            kinds = tuple(sorted(classes - {"admonition"}))
            return (
                Shape("admonition", kinds, self._shape_children(element)),
            )

        if element in self.canonical_tabs:
            return (self._tab_shape(element),)

        if tag == "div" and {"grid", "cards"}.issubset(classes):
            self._claim(element, "card-grid")
            return (Shape("card-grid", children=self._shape_children(element)),)

        if tag == "div" and "footnote" in classes:
            self._claim(element, "footnotes")
            return (Shape("footnotes", children=self._shape_children(element)),)

        if re.fullmatch(r"h[1-6]", tag):
            self._claim(element, f"heading:{tag[1]}")
            return (
                Shape(
                    f"heading:{tag[1]}",
                    children=self._inline_shapes(element),
                ),
            )
        if tag == "p":
            kind = "admonition-title" if "admonition-title" in classes else "paragraph"
            self._claim(element, kind)
            return (Shape(kind, children=self._inline_shapes(element)),)
        if tag == "blockquote":
            self._claim(element, "blockquote")
            return (Shape("blockquote", children=self._shape_children(element)),)
        if tag in {"ul", "ol"}:
            kind = "list:unordered" if tag == "ul" else "list:ordered"
            self._claim(element, kind)
            attributes: tuple[str, ...] = ()
            if tag == "ol":
                marker_type = element.attrib.get("type", "1")
                if marker_type not in {"1", "a", "A", "i", "I"}:
                    marker_type = "1"
                start = _normalized_html_integer(element.attrib.get("start"))
                attributes = (
                    f"reversed={'reversed' in element.attrib}",
                    f"type={marker_type}",
                    f"start={start or 'auto'}",
                )
            return (Shape(kind, attributes, self._shape_children(element)),)
        if tag == "li":
            self._claim(element, "list-item")
            value = _normalized_html_integer(element.attrib.get("value"))
            attributes = (f"value={value or 'auto'}",)
            return (
                Shape(
                    "list-item", attributes, children=self._shape_children(element)
                ),
            )
        if tag == "dl":
            self._claim(element, "definition-list")
            return (Shape("definition-list", children=self._shape_children(element)),)
        if tag == "dt":
            self._claim(element, "definition-term")
            return (Shape("definition-term", children=self._inline_shapes(element)),)
        if tag == "dd":
            self._claim(element, "definition-description")
            return (
                Shape("definition-description", children=self._shape_children(element)),
            )
        if tag == "table":
            self._claim(element, "table")
            return (Shape("table", children=self._shape_children(element)),)
        if tag in {"thead", "tbody", "tfoot"}:
            kind = {"thead": "table-head", "tbody": "table-body", "tfoot": "table-foot"}[tag]
            self._claim(element, kind)
            return (Shape(kind, children=self._shape_children(element)),)
        if tag == "tr":
            self._claim(element, "table-row")
            return (Shape("table-row", children=self._shape_children(element)),)
        if tag in {"th", "td"}:
            self._claim(element, f"table-cell:{tag}")
            alignment = self._table_alignment(element)
            attributes = (
                f"align={alignment}",
                f"colspan={element.attrib.get('colspan', '1')}",
                f"rowspan={element.attrib.get('rowspan', '1')}",
            )
            return (
                Shape(
                    f"table-cell:{tag}",
                    attributes,
                    self._shape_children(element),
                ),
            )
        if tag == "caption":
            self._claim(element, "table-caption")
            return (Shape("table-caption", children=self._inline_shapes(element)),)
        if tag in {"colgroup", "col"}:
            kind = f"table-{tag}"
            self._claim(element, kind)
            return (Shape(kind, children=self._shape_children(element)),)
        if tag == "hr":
            self._claim(element, "thematic-break")
            return (Shape("thematic-break"),)
        if tag == "details":
            self._claim(element, "details")
            attributes = (
                f"open={'open' in element.attrib}",
                f"name={element.attrib.get('name', '')}",
                *(f"class={value}" for value in _classes(element)),
            )
            return (Shape("details", attributes, self._shape_children(element)),)
        if tag == "summary":
            self._claim(element, "summary")
            return (Shape("summary", children=self._inline_shapes(element)),)
        if tag == "pre":
            self._claim(element, "code-block")
            return (self._code_block_shape(element),)
        if tag == "br":
            self._claim(element, "hard-break")
            return (Shape("hard-break"),)
        if tag == "img":
            self._claim(element, "image")
            return (Shape("image"),)
        if tag == "a":
            self._claim(element, "link")
            return (Shape("link", children=self._inline_shapes(element)),)
        if tag == "code":
            # Inline code is compared lexically and may have bounded additions.
            return ()
        if tag in TRANSPARENT_INLINE_TAGS:
            return self._inline_shapes(element)

        raw_kind = f"raw:{tag}"
        self._claim(element, raw_kind)
        attributes = (f"open={'open' in element.attrib}",) if tag == "dialog" else ()
        return (Shape(raw_kind, attributes, self._shape_children(element)),)

    def _inline_shapes(self, element: Element) -> tuple[Shape, ...]:
        return tuple(node for child in element for node in self._shape_element(child))

    def _tab_shape(self, element: Element) -> Shape:
        self._claim(element, "tabs")
        labels_container = next(
            (
                child
                for child in element
                if _tag(child) == "div" and _has_class(child, "tabbed-labels")
            ),
            None,
        )
        content_container = next(
            (
                child
                for child in element
                if _tag(child) == "div" and _has_class(child, "tabbed-content")
            ),
            None,
        )
        labels = (
            [child for child in labels_container if _tag(child) == "label"]
            if labels_container is not None
            else []
        )
        blocks = (
            [
                child
                for child in content_container
                if _tag(child) == "div" and _has_class(child, "tabbed-block")
            ]
            if content_container is not None
            else []
        )
        tabs: list[Shape] = []
        for index in range(max(len(labels), len(blocks))):
            children: list[Shape] = []
            if index < len(labels):
                label = labels[index]
                self._claim(label, "tab-label")
                children.append(Shape("tab-label", children=self._inline_shapes(label)))
            if index < len(blocks):
                block = blocks[index]
                self._claim(block, "tab")
                children.extend(self._shape_children(block))
            tabs.append(Shape("tab", children=tuple(children)))
        return Shape("tabs", (f"count={len(tabs)}",), tuple(tabs))

    @staticmethod
    def _table_alignment(element: Element) -> str:
        declaration = _winning_inline_style(
            element, "text-align", _VALID_TEXT_ALIGN_VALUES
        )
        if declaration is not None:
            value, important = declaration
            return f"{value}{' !important' if important else ''}"
        legacy = element.attrib.get("align", "").strip().lower()
        if legacy not in {"left", "right", "center", "justify", "char"}:
            legacy = "none"
        return legacy

    def _visible_units(self) -> tuple[VisibleUnit, ...]:
        units: list[VisibleUnit] = []

        def append_top_level_text(value: str) -> None:
            text = _normalize_visible_text(value)
            if not text:
                return
            units.append(
                VisibleUnit(
                    ordinal=len(units) + 1,
                    kind="raw:text",
                    text=text,
                    inline_codes=(),
                    facts=_extract_facts(text),
                    standalone_source_link=False,
                )
            )

        def append_element(element: Element) -> None:
            info = self.owner_info.get(element)
            if info is None:
                is_code_filename = (
                    element in self.code_filename_elements
                    and not _is_hidden_context(element, self.parents)
                    and not _is_in_inert_dom_context(
                        element, self.parents, include_self=True
                    )
                )
                if is_code_filename:
                    text = _normalize_visible_text("".join(element.itertext()))
                    units.append(
                        VisibleUnit(
                            ordinal=len(units) + 1,
                            kind="code-filename",
                            text=text,
                            inline_codes=(),
                            facts=_extract_facts(text),
                            standalone_source_link=False,
                        )
                    )
            else:
                kind, _shape_ordinal = info
                if kind not in NON_PROSE_KINDS and not _is_hidden_context(
                    element, self.parents
                ):
                    text_parts: list[str] = []
                    inline_codes: list[str] = []
                    tokens: list[str] = []
                    self._collect_local_content(
                        element,
                        owner=element,
                        text_parts=text_parts,
                        inline_codes=inline_codes,
                        tokens=tokens,
                    )
                    text = _normalize_visible_text("".join(text_parts))
                    if not (
                        not text
                        and not inline_codes
                        and (
                            kind in CONTAINER_KINDS
                            or kind.startswith("list:")
                            or kind.startswith("table-")
                        )
                    ):
                        units.append(
                            VisibleUnit(
                                ordinal=len(units) + 1,
                                kind=kind,
                                text=text,
                                inline_codes=tuple(inline_codes),
                                facts=_extract_facts(text),
                                standalone_source_link=(
                                    kind in {"paragraph", "list-item"}
                                    and tokens == ["external-source-link"]
                                ),
                            )
                        )
            for child in element:
                append_element(child)

        append_top_level_text(self.fragment.text or "")
        for child in self.fragment:
            append_element(child)
            append_top_level_text(child.tail or "")
        return tuple(units)

    def _collect_local_content(
        self,
        element: Element,
        *,
        owner: Element,
        text_parts: list[str],
        inline_codes: list[str],
        tokens: list[str],
    ) -> None:
        if element.text:
            text_parts.append(element.text)
            if element.text.strip():
                tokens.append("text")
        for child in element:
            child_tag = _tag(child)
            if (
                child_tag == "#comment"
                or self._is_generated(child)
                or _is_hidden_context(child, self.parents)
            ):
                pass
            elif child_tag in {"pre", "script", "style", "template"}:
                tokens.append("block")
            elif child_tag == "code":
                if not _is_in_literal_or_inert_context(child, self.parents):
                    inline_codes.append("".join(child.itertext()))
                    tokens.append("code")
            elif child_tag == "img":
                alt = child.attrib.get("alt", "")
                text_parts.append(alt)
                tokens.append("image")
            elif child_tag == "a":
                if not _is_in_literal_or_inert_context(child, self.parents):
                    link_tokens: list[str] = []
                    if child.text or len(child):
                        self._collect_local_content(
                            child,
                            owner=owner,
                            text_parts=text_parts,
                            inline_codes=inline_codes,
                            tokens=link_tokens,
                        )
                    tokens.append(
                        "external-source-link"
                        if (
                            link_tokens
                            and set(link_tokens) == {"text"}
                            and _is_external_http_destination(
                                child.attrib.get("href", "")
                            )
                        )
                        else "non-source-link"
                    )
            elif child in self.owner_info and child is not owner:
                child_kind = self.owner_info[child][0]
                if child_kind not in {"link", "image", "hard-break"}:
                    tokens.append("block")
                else:
                    self._collect_local_content(
                        child,
                        owner=owner,
                        text_parts=text_parts,
                        inline_codes=inline_codes,
                        tokens=tokens,
                    )
            else:
                self._collect_local_content(
                    child,
                    owner=owner,
                    text_parts=text_parts,
                    inline_codes=inline_codes,
                    tokens=tokens,
                )
            if child.tail:
                text_parts.append(child.tail)
                if child.tail.strip():
                    tokens.append("text")

    def _surface_text(self, element: Element) -> str:
        parts: list[str] = []

        def visit(current: Element) -> None:
            if current.text:
                parts.append(current.text)
            for child in current:
                if (
                    _tag(child) == "#comment"
                    or self._is_generated(child)
                    or _is_hidden_context(child, self.parents)
                ):
                    pass
                elif _tag(child) in {"pre", "script", "style", "template", "img"}:
                    pass
                else:
                    visit(child)
                if child.tail:
                    parts.append(child.tail)

        visit(element)
        return _normalize_visible_text("".join(parts))

    def _standalone_external_source_title(
        self, link: Element, *, source_section: bool
    ) -> bool:
        if not source_section or not _is_external_http_destination(
            link.attrib.get("href", "")
        ):
            return False
        current = self.parents.get(link)
        while current is not None:
            info = self.owner_info.get(current)
            if info is not None:
                if info[0] not in {"paragraph", "list-item"}:
                    return False
                text_parts: list[str] = []
                inline_codes: list[str] = []
                tokens: list[str] = []
                self._collect_local_content(
                    current,
                    owner=current,
                    text_parts=text_parts,
                    inline_codes=inline_codes,
                    tokens=tokens,
                )
                return tokens == ["external-source-link"]
            current = self.parents.get(current)
        return False

    def _clone_surfaces(self) -> tuple[CloneSurface, ...]:
        surfaces: list[CloneSurface] = []
        source_section_level: int | None = None
        for element in self.fragment.iter():
            tag = _tag(element)
            heading = re.fullmatch(r"h([1-6])", tag)
            if heading is not None:
                level = int(heading.group(1))
                if source_section_level is not None and level <= source_section_level:
                    source_section_level = None
                if not _is_hidden_context(
                    element, self.parents
                ) and not _is_in_inert_dom_context(
                    element, self.parents, include_self=True
                ):
                    heading_text = (
                        self._surface_text(element).casefold().rstrip(" :：")
                    )
                    if heading_text in SOURCE_SECTION_TITLES:
                        source_section_level = level
            if tag not in {"a", "img"}:
                continue
            if (
                self._is_in_generated_context(element)
                or _is_hidden_context(element, self.parents)
                or _is_in_literal_or_inert_context(
                    element, self.parents, include_self=True
                )
            ):
                continue
            if tag == "a":
                text = self._surface_text(element)
                surfaces.append(
                    CloneSurface(
                        len(surfaces) + 1,
                        "link-label",
                        text,
                        bool(text)
                        and self._standalone_external_source_title(
                            element,
                            source_section=source_section_level is not None,
                        ),
                    )
                )
            else:
                text = _normalize_visible_text(element.attrib.get("alt", ""))
                surfaces.append(
                    CloneSurface(len(surfaces) + 1, "image-alt", text)
                )
        return tuple(surfaces)

    def _policy_owner(self, node: _RawTextNode) -> object:
        current = node.context
        fallback: Element | None = None
        while current is not None:
            info = self.owner_info.get(current)
            if info is not None:
                if fallback is None:
                    fallback = current
                if info[0] not in NON_PROSE_KINDS:
                    return current
            current = self.parents.get(current)
        return fallback if fallback is not None else node

    def _is_code_filename_context(self, element: Element | None) -> bool:
        current = element
        while current is not None:
            if current in self.code_filename_elements:
                return True
            current = self.parents.get(current)
        return False

    def _policy_text_units(
        self, text_nodes: Sequence[_RawTextNode]
    ) -> tuple[str, ...]:
        groups: list[tuple[object, list[str]]] = []
        for node in text_nodes:
            if not node.value:
                continue
            context = node.context
            if context is not None:
                if (
                    self._is_in_generated_context(context)
                    or _is_hidden_context(context, self.parents)
                    or _is_in_inert_dom_context(
                        context, self.parents, include_self=True
                    )
                ):
                    continue
                if _is_in_literal_or_inert_context(
                    context, self.parents, include_self=True
                ) and not self._is_code_filename_context(context):
                    continue
            owner = self._policy_owner(node)
            if groups and groups[-1][0] is owner:
                groups[-1][1].append(node.value)
            else:
                groups.append((owner, [node.value]))
        return tuple(
            text
            for _owner, parts in groups
            if (text := _normalize_visible_text("".join(parts)))
        )

    def _destinations(
        self, raw_destinations: Sequence[_RawDestination]
    ) -> tuple[Destination, ...]:
        records: list[Destination] = []
        for raw in raw_destinations:
            element = raw.element
            # The script element's src is active, while descendants of
            # script/style/template are inert.
            if _is_in_inert_dom_context(element, self.parents):
                continue
            kind = f"{_tag(element)}:{raw.attribute}"
            if _attribute_local_name(raw.attribute) == "srcset":
                kind += f"[{raw.descriptor or 'default'}]"
            records.append(
                _make_destination(len(records) + 1, kind, raw.value)
            )
        return tuple(records)

    def _nearest_block_owner(self, element: Element) -> tuple[str, int]:
        current: Element | None = element
        while current is not None:
            info = self.owner_info.get(current)
            if info is not None and info[0] not in {"link", "image", "hard-break"}:
                return info
            current = self.parents.get(current)
        return ("document", 0)

    def _anchors(
        self, raw_ids: Sequence[tuple[Element, str]]
    ) -> tuple[
        tuple[Anchor, ...], Mapping[str, tuple[Anchor, ...]], tuple[str, ...]
    ]:
        anchors: list[Anchor] = []
        index: defaultdict[str, list[Anchor]] = defaultdict(list)
        id_counts = Counter(
            value
            for element, value in raw_ids
            if not _is_in_inert_dom_context(element, self.parents)
        )
        local_counts: defaultdict[tuple[str, int], int] = defaultdict(int)
        for element in self.fragment.iter():
            if _tag(element) == "#comment" or _is_in_inert_dom_context(
                element, self.parents
            ):
                continue
            element_id = element.attrib.get("id")
            element_name = element.attrib.get("name") if _tag(element) == "a" else None
            values = tuple(
                dict.fromkeys(
                    value for value in (element_id, element_name) if value is not None
                )
            )
            if not values:
                continue
            owner_kind, owner_ordinal = self._nearest_block_owner(element)
            owner_key = (owner_kind, owner_ordinal)
            local_counts[owner_key] += 1
            anchor = Anchor(
                ordinal=len(anchors) + 1,
                values=values,
                signature=(
                    _tag(element),
                    owner_kind,
                    owner_ordinal,
                    local_counts[owner_key],
                    element_id is not None,
                    element_name is not None,
                ),
            )
            anchors.append(anchor)
            for value in values:
                index[value].append(anchor)
        frozen_index = MappingProxyType(
            {value: tuple(index[value]) for value in sorted(index)}
        )
        duplicates = tuple(
            sorted(value for value, count in id_counts.items() if count > 1)
        )
        return tuple(anchors), frozen_index, duplicates

    def _nearest_highlight_wrapper(self, element: Element) -> Element | None:
        current = self.parents.get(element)
        while current is not None:
            if _tag(current) == "div" and _has_class(current, "highlight"):
                return current
            current = self.parents.get(current)
        return None

    def _code_presentation_records(
        self, pre: Element, code: Element | None
    ) -> tuple[str, ...]:
        records: list[str] = []
        line_starts: list[int] = []
        if code is not None:
            for element in code.iter():
                element_id = element.attrib.get("id", "")
                match = re.fullmatch(r"__codelineno-\d+-(\d+)", element_id)
                if match is not None:
                    line_starts.append(int(match.group(1)))
                    records.append(
                        "line-anchor:"
                        f"id={element_id};name={element.attrib.get('name', '')};"
                        f"href={element.attrib.get('href', '')}"
                    )
        wrapper = self._nearest_highlight_wrapper(pre)
        if wrapper is not None:
            for element in wrapper.iter():
                classes = set(_classes(element))
                if "filename" in classes and not any(
                    "filename" in _classes(child) for child in element
                ):
                    records.append(
                        f"filename:{_tag(element)}:{''.join(element.itertext())}"
                    )
                if _tag(element) == "td" and "linenos" in classes:
                    records.append(f"linenos:{''.join(element.itertext())}")
                href_match = re.fullmatch(
                    r"#__codelineno-\d+-(\d+)", element.attrib.get("href", "")
                )
                if href_match is not None:
                    line_starts.append(int(href_match.group(1)))
        if line_starts:
            records.append(f"start-line={line_starts[0]}")
        for target, label in ((pre, "pre"), (code, "code"), (wrapper, "wrapper")):
            if target is None:
                continue
            for name, value in sorted(target.attrib.items()):
                if name != "class":
                    records.append(f"attribute:{label}:{name}={value}")
        return tuple(sorted(records))

    def _syntax_class_ranges(self, code: Element) -> tuple[str, ...]:
        events: list[tuple[int, int, str, str]] = []
        offset = 0

        def walk(element: Element) -> None:
            nonlocal offset
            start = offset
            if element.text:
                offset += len(element.text)
            for child in element:
                walk(child)
                if child.tail:
                    offset += len(child.tail)
            end = offset
            if element is code or self._is_generated(element):
                return
            events.extend(
                (start, end, _tag(element), value) for value in _classes(element)
            )

        walk(code)
        return tuple(
            f"syntax:{tag_name}.{class_name}@{start}:{end}"
            for start, end, tag_name, class_name in sorted(events)
        )

    def _block_codes(
        self, raw_code_blocks: Sequence[_RawCodeText]
    ) -> tuple[BlockCode, ...]:
        blocks: list[BlockCode] = []
        for raw in raw_code_blocks:
            pre = raw.pre
            code = raw.code
            if (
                pre in self.lineno_pre_elements
                or _is_in_inert_dom_context(pre, self.parents, include_self=True)
            ):
                continue
            classes: list[str] = []
            for target, label in ((pre, "pre"), (code, "code")):
                if target is not None:
                    classes.extend(f"{label}:{value}" for value in _classes(target))
            if code is not None:
                classes.extend(self._syntax_class_ranges(code))
            classes.extend(self._code_presentation_records(pre, code))
            current = self.parents.get(pre)
            hops = 0
            while current is not None and hops < 5:
                current_tag = _tag(current)
                for value in _classes(current):
                    classes.append(f"wrapper:{current_tag}.{value}")
                for name, value in sorted(current.attrib.items()):
                    if name != "class":
                        classes.append(
                            f"wrapper-attribute:{current_tag}:{name}={value}"
                        )
                if current in self.owner_info and self.owner_info[current][0] not in {
                    "code-block",
                    "highlight-wrapper",
                }:
                    break
                current = self.parents.get(current)
                hops += 1
            blocks.append(
                BlockCode(
                    ordinal=len(blocks) + 1,
                    pre_text=raw.pre_text,
                    code_text=raw.code_text,
                    semantic_classes=tuple(sorted(classes)),
                )
            )
        return tuple(blocks)

    def _policy_values(self, visible_text: str) -> tuple[str, ...]:
        values = [visible_text]
        for element in self.fragment.iter():
            if _tag(element) == "#comment":
                continue
            if _is_in_inert_dom_context(element, self.parents):
                continue
            # Generated UI has safe, deterministic attributes under the checked
            # renderer profile. Keeping those values closes authored-lookalike
            # bypasses without adding generated labels to visible prose.
            values.extend(element.attrib.values())
            if "filename" in _classes(element):
                values.append("".join(element.itertext()))
        return tuple(values)


def _parse_srcset_candidates(value: str) -> tuple[tuple[str, str], ...]:
    """Parse bounded common srcset candidates using the HTML tokenization shape.

    This intentionally models URL candidates and descriptors, not arbitrary
    browser fetch selection or JavaScript mutation.
    """

    candidates: list[tuple[str, str]] = []
    position = 0
    length = len(value)
    whitespace = " \t\n\r\f"
    while position < length:
        while position < length and value[position] in whitespace + ",":
            position += 1
        if position >= length:
            break
        url_start = position
        while position < length and value[position] not in whitespace:
            position += 1
        url = value[url_start:position]
        if url.endswith(","):
            url = url.rstrip(",")
            descriptor = ""
        else:
            while position < length and value[position] in whitespace:
                position += 1
            descriptor_start = position
            parentheses = 0
            while position < length:
                character = value[position]
                if character == "(":
                    parentheses += 1
                elif character == ")" and parentheses:
                    parentheses -= 1
                elif character == "," and parentheses == 0:
                    break
                position += 1
            descriptor = " ".join(value[descriptor_start:position].split())
        if url:
            candidates.append((url, descriptor))
            if len(candidates) > MAX_RESOURCE_DESTINATIONS:
                raise ValueError(
                    f"srcset exceeds {MAX_RESOURCE_DESTINATIONS} candidates"
                )
        if position < length and value[position] == ",":
            position += 1
    return tuple(candidates)


def _split_destination(value: str) -> tuple[str, str | None, str | None]:
    try:
        parsed = urllib.parse.urlsplit(value)
    except ValueError:
        before_fragment, fragment_separator, fragment = value.partition("#")
        base, query_separator, query = before_fragment.partition("?")
        return (
            base,
            query if query_separator else None,
            fragment if fragment_separator else None,
        )
    before_query = urllib.parse.urlunsplit(
        (parsed.scheme, parsed.netloc, parsed.path, "", "")
    )
    return (
        before_query,
        parsed.query if "?" in value.partition("#")[0] else None,
        parsed.fragment if "#" in value else None,
    )


def _normalized_destination_path(value: str) -> str:
    try:
        raw_path = urllib.parse.urlsplit(value).path
    except ValueError:
        raw_path = value.partition("#")[0].partition("?")[0]
    decoded = raw_path
    for _ in range(3):
        candidate = urllib.parse.unquote(decoded, errors="replace")
        if candidate == decoded:
            break
        decoded = candidate
    normalized = posixpath.normpath(decoded.replace("\\", "/"))
    return "" if normalized == "." and not decoded else normalized


def _canonical_markdown_base(base: str) -> str:
    try:
        parsed = urllib.parse.urlsplit(base)
    except ValueError:
        return base
    if parsed.scheme or parsed.netloc or parsed.path.startswith(("/", "\\")):
        return base
    decoded_path = urllib.parse.unquote(parsed.path, errors="replace").replace(
        "\\", "/"
    )
    if PurePosixPath(decoded_path).suffix != CANONICAL_SUFFIX:
        return base
    return posixpath.normpath(decoded_path)


def _make_destination(ordinal: int, kind: str, value: str) -> Destination:
    base, query, fragment = _split_destination(value)
    return Destination(
        ordinal=ordinal,
        kind=kind,
        value=value,
        base=base,
        comparison_base=_canonical_markdown_base(base),
        normalized_path=_normalized_destination_path(value),
        query=query,
        fragment=fragment,
    )


def _is_external_http_destination(value: str) -> bool:
    return _is_valid_http_url(value)


def _normalize_visible_text(value: str) -> str:
    return re.sub(r"\s+", " ", value, flags=re.UNICODE).strip()


FACT_PATTERNS = (
    (
        "date",
        re.compile(
            r"(?<![A-Za-z0-9.-])\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?(?!\d|-\d|\.\d)"
        ),
    ),
    (
        "version",
        re.compile(
            r"(?<![A-Za-z0-9])v?\d+(?:\.\d+)+(?:[-+][0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?![A-Za-z0-9]|\.\d)"
        ),
    ),
    ("commit", re.compile(r"(?<![A-Za-z0-9])[0-9A-Fa-f]{7,64}(?![A-Za-z0-9])")),
    ("ghsa", re.compile(r"\bGHSA-[A-Za-z0-9-]+\b", re.IGNORECASE)),
)


def _extract_facts(text: str) -> tuple[Fact, ...]:
    matches: list[tuple[int, int, str, str]] = []
    for priority, (kind, pattern) in enumerate(FACT_PATTERNS):
        for match in pattern.finditer(text):
            matches.append((match.start(), priority, kind, match.group(0)))
    matches.sort(key=lambda item: (item[0], item[1]))
    return tuple(Fact(kind, value) for _start, _priority, kind, value in matches)


def _dom_size(fragment: Element) -> tuple[int, int]:
    count = 0
    maximum_depth = 0
    stack: list[tuple[Element, int]] = [(fragment, 0)]
    while stack:
        element, depth = stack.pop()
        count += 1
        maximum_depth = max(maximum_depth, depth)
        if count > MAX_DOM_NODES or maximum_depth > MAX_DOM_DEPTH:
            break
        stack.extend((child, depth + 1) for child in reversed(list(element)))
    return count, maximum_depth


def _render_page(
    path: str,
    body: str,
    profile: RendererProfile,
    collector: _IssueCollector,
) -> PageModel | None:
    try:
        extension_configs = {
            key: _thaw_config(value) for key, value in profile.mdx_configs
        }
        renderer = markdown.Markdown(
            extensions=list(profile.markdown_extensions),
            extension_configs=extension_configs,
        )
        rendered = renderer.convert(body)
    except Exception as error:
        collector.add(
            "render/failed",
            path,
            f"Python-Markdown rendering failed: {type(error).__name__}: {error}",
        )
        return None
    if len(rendered.encode("utf-8")) > MAX_RENDERED_BYTES:
        collector.add(
            "render/too-large",
            path,
            f"rendered fragment exceeds {MAX_RENDERED_BYTES} bytes",
        )
        return None
    try:
        fragment = html5lib.parseFragment(rendered)
    except Exception as error:
        collector.add(
            "render/html-failed",
            path,
            f"html5lib fragment parsing failed: {type(error).__name__}: {error}",
        )
        return None
    count, depth = _dom_size(fragment)
    if count > MAX_DOM_NODES:
        collector.add(
            "render/dom-node-limit",
            path,
            f"rendered DOM exceeds {MAX_DOM_NODES} nodes",
        )
        return None
    if depth > MAX_DOM_DEPTH:
        collector.add(
            "render/dom-depth-limit",
            path,
            f"rendered DOM exceeds depth {MAX_DOM_DEPTH}",
        )
        return None
    try:
        return _DomModelBuilder(path, fragment).build()
    except Exception as error:
        collector.add(
            "render/model-failed",
            path,
            f"rendered PageModel construction failed: {type(error).__name__}: {error}",
        )
        return None


def _policy_decode(value: str) -> str:
    # DOM text/attributes have already undergone HTML entity decoding.
    decoded = value
    for _ in range(3):
        candidate = urllib.parse.unquote(decoded, errors="replace")
        if candidate == decoded:
            break
        decoded = candidate
    return decoded


def _validate_page_policy(
    model: PageModel,
    locales: Sequence[str],
    collector: _IssueCollector,
) -> None:
    visible = model.visible_text
    translation = re.search(r"Translation\s+pending", visible, re.IGNORECASE)
    if translation:
        collector.add(
            "policy/translation-pending",
            model.path,
            "visible rendered text contains a Translation pending placeholder",
            rendered_ordinal=_unit_for_offset(model.policy_text_units, translation.start()),
            excerpt=translation.group(0),
        )
    todo = re.search(r"(?<![A-Za-z0-9_])TODO(?![A-Za-z0-9_])", visible)
    if todo:
        collector.add(
            "policy/todo",
            model.path,
            "visible rendered text contains a TODO placeholder",
            rendered_ordinal=_unit_for_offset(model.policy_text_units, todo.start()),
            excerpt=todo.group(0),
        )

    decoded_values = tuple(_policy_decode(value) for value in model.policy_values)
    checks = (
        (
            "policy/specstory",
            re.compile(r"(?<![A-Za-z0-9_])\.specstory(?:[/\\?#]|$)", re.IGNORECASE),
            "rendered content references raw .specstory material",
        ),
        (
            "policy/sediment",
            re.compile(r"sediment\s*://", re.IGNORECASE),
            "rendered content contains a sediment:// reference",
        ),
        (
            "policy/chatgpt-tracking",
            re.compile(r"\butm_source\s*=\s*chatgpt(?:\.com)?\b", re.IGNORECASE),
            "rendered content contains a ChatGPT tracking parameter",
        ),
    )
    for rule_id, pattern, message in checks:
        match_value = next((value for value in decoded_values if pattern.search(value)), None)
        if match_value is not None:
            collector.add(rule_id, model.path, message, excerpt=match_value)

    locale_pattern = re.compile(
        rf"\.(?:{'|'.join(re.escape(locale) for locale in locales)})\.md$",
        re.IGNORECASE,
    )
    for destination in model.destinations:
        if locale_pattern.search(destination.normalized_path):
            collector.add(
                "policy/explicit-locale-destination",
                model.path,
                "destination explicitly names a localized Markdown sibling; use the canonical .md path",
                rendered_ordinal=destination.ordinal,
                excerpt=destination.value,
            )
            break

    for duplicate in model.duplicate_ids:
        collector.add(
            "anchor/duplicate-id",
            model.path,
            f"rendered DOM contains duplicate id {duplicate!r}",
            excerpt=duplicate,
        )


def _unit_for_offset(units: Sequence[str], offset: int) -> int | None:
    cursor = 0
    for ordinal, text in enumerate(units, start=1):
        end = cursor + len(text)
        if cursor <= offset <= end:
            return ordinal
        cursor = end + 1
    return None


def _first_shape_difference(
    english: Sequence[Shape], translation: Sequence[Shape], path: str = "root"
) -> str | None:
    if len(english) != len(translation):
        return f"{path} child count is {len(english)} versus {len(translation)}"
    for index, (left, right) in enumerate(zip(english, translation), start=1):
        location = f"{path}/{index}"
        if left.kind != right.kind:
            return f"{location} kind is {left.kind!r} versus {right.kind!r}"
        if left.attributes != right.attributes:
            return f"{location} attributes are {left.attributes!r} versus {right.attributes!r}"
        nested = _first_shape_difference(left.children, right.children, location)
        if nested:
            return nested
    return None


def _resolve_relative_markdown_target(page: str, base: str) -> str | None:
    if base == "":
        return page
    try:
        parsed = urllib.parse.urlsplit(base)
    except ValueError:
        return None
    if parsed.scheme or parsed.netloc or parsed.path.startswith(("/", "\\")):
        return None
    decoded_path = urllib.parse.unquote(parsed.path, errors="replace").replace(
        "\\", "/"
    )
    if PurePosixPath(decoded_path).suffix != CANONICAL_SUFFIX:
        return None
    target = posixpath.normpath(
        posixpath.join(PurePosixPath(page).parent.as_posix(), decoded_path)
    )
    if target == ".." or target.startswith("../"):
        return None
    return target


def _local_fragment_correspondence(
    english_page: str,
    english_destination: Destination,
    translation_destination: Destination,
    locale: str,
    models: Mapping[str, PageModel],
) -> bool | None:
    if not (
        english_destination.kind.endswith(":href")
        and translation_destination.kind.endswith(":href")
    ):
        return None
    if english_destination.fragment is None or translation_destination.fragment is None:
        return None
    if english_destination.comparison_base != translation_destination.comparison_base:
        return False
    if english_destination.query != translation_destination.query:
        return False

    english_target = _resolve_relative_markdown_target(
        english_page, english_destination.comparison_base
    )
    if english_target is None:
        return None
    translation_target = _localized_path(english_target, locale)
    english_model = models.get(english_target)
    translation_model = models.get(translation_target)
    if english_model is None or translation_model is None:
        return False
    english_fragment = urllib.parse.unquote(
        english_destination.fragment, errors="replace"
    )
    translation_fragment = urllib.parse.unquote(
        translation_destination.fragment, errors="replace"
    )
    if not english_fragment or not translation_fragment:
        return False
    english_signature = english_model.target_for_fragment(english_fragment)
    translation_signature = translation_model.target_for_fragment(
        translation_fragment
    )
    return (
        english_signature is not None
        and translation_signature is not None
        and english_signature == translation_signature
    )


def _compare_pair(
    english: ParsedPage,
    translation: ParsedPage,
    locale: str,
    models: Mapping[str, PageModel],
    collector: _IssueCollector,
) -> None:
    paired_path = translation.path
    if english.metadata is not None and translation.metadata is not None and english.metadata != translation.metadata:
        collector.add(
            "frontmatter/mismatch",
            english.path,
            "parsed metadata differ semantically; mapping order/comments are ignored but list order is retained",
            paired_path=paired_path,
        )

    left = english.model
    right = translation.model
    if left is None or right is None:
        return

    shape_difference = _first_shape_difference(left.shape, right.shape)
    if shape_difference:
        collector.add(
            "pair/structure",
            english.path,
            f"rendered semantic block shape differs: {shape_difference}",
            paired_path=paired_path,
        )

    if left.block_codes != right.block_codes:
        index = _first_sequence_difference(left.block_codes, right.block_codes)
        collector.add(
            "pair/block-code",
            english.path,
            f"rendered pre/code text or semantic classes differ at block {index}",
            paired_path=paired_path,
            rendered_ordinal=index,
            excerpt=_paired_values(left.block_codes, right.block_codes, index),
        )

    if left.anchor_shapes != right.anchor_shapes:
        index = _first_sequence_difference(left.anchor_shapes, right.anchor_shapes)
        collector.add(
            "pair/anchor-shape",
            english.path,
            f"rendered ID/anchor-bearing node shape differs at anchor {index}",
            paired_path=paired_path,
            rendered_ordinal=index,
            excerpt=_paired_values(left.anchor_shapes, right.anchor_shapes, index),
        )

    _compare_destinations(english.path, paired_path, locale, left, right, models, collector)
    _compare_clone_surfaces(
        english.path,
        paired_path,
        locale,
        left.clone_surfaces,
        right.clone_surfaces,
        collector,
    )

    left_unit_kinds = tuple(unit.kind for unit in left.visible_units)
    right_unit_kinds = tuple(unit.kind for unit in right.visible_units)
    if left_unit_kinds != right_unit_kinds:
        index = _first_sequence_difference(left_unit_kinds, right_unit_kinds)
        collector.add(
            "pair/visible-unit-shape",
            english.path,
            f"rendered visible prose unit shape differs at unit {index}",
            paired_path=paired_path,
            rendered_ordinal=index,
            excerpt=_paired_values(left_unit_kinds, right_unit_kinds, index),
        )
        return

    for left_unit, right_unit in zip(left.visible_units, right.visible_units):
        if not _inline_codes_preserved(left_unit.inline_codes, right_unit.inline_codes):
            collector.add(
                "pair/inline-code",
                english.path,
                "translation does not preserve exact English inline-code values and required multiplicity within the aligned unit",
                paired_path=paired_path,
                rendered_ordinal=left_unit.ordinal,
                excerpt=f"English {left_unit.inline_codes!r}; {locale} {right_unit.inline_codes!r}",
            )
        if left_unit.facts != right_unit.facts:
            collector.add(
                "pair/stable-facts",
                english.path,
                "ordered date/version/commit/GHSA facts differ within the aligned visible unit",
                paired_path=paired_path,
                rendered_ordinal=left_unit.ordinal,
                excerpt=f"English {left_unit.facts!r}; {locale} {right_unit.facts!r}",
            )
        if (
            left_unit.kind != "code-filename"
            and left_unit.text == right_unit.text
            and _substantial_english_prose(left_unit.text)
            and not (
                left_unit.standalone_source_link
                and right_unit.standalone_source_link
            )
        ):
            collector.add(
                "policy/untranslated-clone",
                english.path,
                "aligned rendered prose is an exact substantial English clone",
                paired_path=paired_path,
                rendered_ordinal=left_unit.ordinal,
                excerpt=left_unit.text,
            )


def _compare_clone_surfaces(
    english_path: str,
    paired_path: str,
    locale: str,
    english: Sequence[CloneSurface],
    translation: Sequence[CloneSurface],
    collector: _IssueCollector,
) -> None:
    for left, right in zip(english, translation):
        if left.kind != right.kind:
            continue
        if (
            left.text == right.text
            and _substantial_english_prose(left.text)
            and not (
                left.standalone_source_title
                and right.standalone_source_title
            )
        ):
            collector.add(
                "policy/untranslated-clone",
                english_path,
                f"aligned {left.kind} is an exact substantial English clone",
                paired_path=paired_path,
                rendered_ordinal=left.ordinal,
                excerpt=left.text,
            )


def _inline_codes_preserved(
    english: Sequence[str], translation: Sequence[str]
) -> bool:
    if len(translation) - len(english) > MAX_EXTRA_INLINE_CODES_PER_UNIT:
        return False
    required = Counter(english)
    actual = Counter(translation)
    return all(actual[value] >= count for value, count in required.items())


def _substantial_english_prose(value: str) -> bool:
    # Hyphenated package names, paths, and scoped identifiers are one lexical
    # token, not four prose words merely because punctuation splits them.
    prose_tokens = [
        token for token in value.split() if re.search(r"[A-Za-z]{2,}", token)
    ]
    return len(value) >= 24 and len(prose_tokens) >= 4


def _first_sequence_difference(left: Sequence[Any], right: Sequence[Any]) -> int:
    for index in range(max(len(left), len(right))):
        if index >= len(left) or index >= len(right) or left[index] != right[index]:
            return index + 1
    return 1


def _paired_values(
    left: Sequence[Any], right: Sequence[Any], one_based_index: int
) -> str:
    index = one_based_index - 1
    left_value = left[index] if index < len(left) else "<missing>"
    right_value = right[index] if index < len(right) else "<missing>"
    return f"English {left_value!r}; translation {right_value!r}"


def _compare_destinations(
    english_path: str,
    paired_path: str,
    locale: str,
    english: PageModel,
    translation: PageModel,
    models: Mapping[str, PageModel],
    collector: _IssueCollector,
) -> None:
    for index in range(max(len(english.destinations), len(translation.destinations))):
        left = english.destinations[index] if index < len(english.destinations) else None
        right = translation.destinations[index] if index < len(translation.destinations) else None
        if left is not None and right is not None:
            same_core = (
                left.kind == right.kind
                and left.comparison_base == right.comparison_base
                and left.query == right.query
            )
            if same_core:
                if left.fragment is None and right.fragment is None:
                    continue
                if left.fragment == right.fragment == "":
                    continue
                if left.fragment is not None and right.fragment is not None:
                    correspondence = _local_fragment_correspondence(
                        english_path, left, right, locale, models
                    )
                    if correspondence is True or (
                        correspondence is None and left.fragment == right.fragment
                    ):
                        continue
        collector.add(
            "pair/destination",
            english_path,
            f"ordered source destination kind/logical Markdown base/query/fragment differs at item {index + 1}",
            paired_path=paired_path,
            rendered_ordinal=index + 1,
            excerpt=f"English {left.value if left else '<missing>'!r}; {locale} {right.value if right else '<missing>'!r}",
        )
        return


def _localized_path(canonical_path: str, locale: str) -> str:
    if not canonical_path.endswith(CANONICAL_SUFFIX):
        raise ValueError(f"canonical path does not end in {CANONICAL_SUFFIX}: {canonical_path}")
    return f"{canonical_path[: -len(CANONICAL_SUFFIX)]}.{locale}{CANONICAL_SUFFIX}"


def _localized_locale(path: str, locales: Sequence[str]) -> str | None:
    for locale in sorted(locales, key=len, reverse=True):
        if path.endswith(f".{locale}{CANONICAL_SUFFIX}"):
            return locale
    return None


def _inventory_file_sort_key(filename: str) -> tuple[bool, str]:
    """Match MkDocs' stable README/index-first basename ordering."""

    return (os.path.splitext(filename)[0] not in ("index", "README"), filename)


def _bounded_mkdocs_files(config: Any) -> Files:
    """Build a complete, no-follow MkDocs ``File`` inventory.

    MkDocs 1.6 walks with ``followlinks=True`` and copies non-page entries. This
    traversal classifies every entry before exclusions or ``File`` allocation,
    rejects symlinks and nonregular files, and independently retains identity
    guards for adversarial cyclic or aliased filesystem graphs.
    """

    docs_dir = Path(str(config["docs_dir"]))
    try:
        root_stat = docs_dir.lstat()
    except OSError as error:
        raise InventoryProblem(
            "inventory/read-failed",
            "docs/",
            f"could not stat documentation root: {error}",
        ) from error
    if stat.S_ISLNK(root_stat.st_mode):
        raise InventoryProblem(
            "inventory/symlink",
            "docs/",
            "documentation root must not be a symbolic link",
        )
    if not stat.S_ISDIR(root_stat.st_mode):
        raise InventoryProblem(
            "inventory/docs-root-missing",
            "docs/",
            "documentation root must be a directory",
        )

    root_identity = (root_stat.st_dev, root_stat.st_ino)
    seen_directories = {root_identity}
    # (filesystem path, MkDocs-relative directory, depth, ancestor identities)
    pending: list[tuple[Path, str, int, frozenset[tuple[int, int]]]] = [
        (docs_dir, ".", 0, frozenset({root_identity}))
    ]
    entries_seen = 0
    directories_seen = 1
    files: list[File] = []
    conflicting_files: list[tuple[File, File]] = []

    while pending:
        directory, relative_dir, depth, ancestors = pending.pop()
        child_directories: list[tuple[str, Path, tuple[int, int]]] = []
        filenames: list[str] = []
        try:
            with os.scandir(directory) as entries:
                for entry in entries:
                    entries_seen += 1
                    if entries_seen > MAX_INVENTORY_ENTRIES:
                        raise InventoryProblem(
                            "inventory/entry-limit",
                            "docs/",
                            f"documentation tree exceeds {MAX_INVENTORY_ENTRIES} filesystem entries",
                        )
                    child_relative = os.path.join(relative_dir, entry.name)
                    display_path = PurePosixPath(child_relative).as_posix()
                    stat_result = entry.stat(follow_symlinks=False)
                    if stat.S_ISLNK(stat_result.st_mode):
                        raise InventoryProblem(
                            "inventory/symlink",
                            display_path,
                            "documentation tree entries must not be symbolic links",
                        )
                    if stat.S_ISDIR(stat_result.st_mode):
                        child_directories.append(
                            (
                                entry.name,
                                Path(entry.path),
                                (stat_result.st_dev, stat_result.st_ino),
                            )
                        )
                    elif stat.S_ISREG(stat_result.st_mode):
                        filenames.append(entry.name)
                    else:
                        raise InventoryProblem(
                            "inventory/nonregular-file",
                            display_path,
                            "documentation tree entries must be regular files or directories",
                        )
        except InventoryProblem:
            raise
        except OSError as error:
            display_path = PurePosixPath(relative_dir).as_posix()
            raise InventoryProblem(
                "inventory/read-failed",
                display_path,
                f"could not traverse documentation directory: {error}",
            ) from error

        files_by_dest: dict[str, File] = {}
        for filename in sorted(filenames, key=_inventory_file_sort_key):
            file = File(
                os.path.join(relative_dir, filename),
                str(config["docs_dir"]),
                str(config["site_dir"]),
                bool(config["use_directory_urls"]),
            )
            previous = files_by_dest.setdefault(file.dest_uri, file)
            if previous is not file:
                conflicting_files.append((previous, file))
            files.append(file)

        children: list[tuple[Path, str, int, frozenset[tuple[int, int]]]] = []
        for name, child_path, identity in sorted(child_directories):
            child_relative = os.path.join(relative_dir, name)
            display_path = PurePosixPath(child_relative).as_posix()
            if identity in ancestors:
                raise InventoryProblem(
                    "inventory/directory-cycle",
                    display_path,
                    "documentation directory graph contains an ancestor cycle",
                )
            if identity in seen_directories:
                raise InventoryProblem(
                    "inventory/directory-alias",
                    display_path,
                    "multiple documentation paths resolve to the same directory",
                )
            child_depth = depth + 1
            if child_depth > MAX_INVENTORY_DEPTH:
                raise InventoryProblem(
                    "inventory/depth-limit",
                    display_path,
                    f"documentation directory depth exceeds {MAX_INVENTORY_DEPTH}",
                )
            directories_seen += 1
            if directories_seen > MAX_INVENTORY_DIRECTORIES:
                raise InventoryProblem(
                    "inventory/directory-limit",
                    "docs/",
                    f"documentation tree exceeds {MAX_INVENTORY_DIRECTORIES} directories",
                )
            seen_directories.add(identity)
            children.append(
                (
                    child_path,
                    child_relative,
                    child_depth,
                    ancestors | {identity},
                )
            )
        # A LIFO stack with reverse insertion preserves MkDocs' sorted DFS walk.
        pending.extend(reversed(children))

    set_exclusions(files, config)
    # Match MkDocs' README/index destination-conflict resolution.
    for first, second in conflicting_files:
        if second.inclusion.is_included():
            try:
                files.remove(first)
            except ValueError:
                pass
        else:
            try:
                files.remove(second)
            except ValueError:
                pass

    return Files(files)


def _read_bounded_source(path: Path) -> tuple[str, int]:
    flags = os.O_RDONLY
    for flag_name in ("O_BINARY", "O_CLOEXEC", "O_NOFOLLOW", "O_NONBLOCK"):
        flags |= int(getattr(os, flag_name, 0))
    try:
        descriptor = os.open(path, flags)
    except OSError as error:
        if error.errno in {errno.ELOOP, errno.EMLINK, errno.ENXIO}:
            raise SourceReadProblem(
                "page/nonregular-file",
                "published Markdown source must be a regular non-symlink file",
            ) from error
        raise SourceReadProblem(
            "page/read-failed", f"could not open UTF-8 source: {error}"
        ) from error

    try:
        try:
            descriptor_stat = os.fstat(descriptor)
        except OSError as error:
            raise SourceReadProblem(
                "page/read-failed", f"could not inspect opened source: {error}"
            ) from error
        if not stat.S_ISREG(descriptor_stat.st_mode):
            raise SourceReadProblem(
                "page/nonregular-file",
                "published Markdown source must be a regular file",
            )
        try:
            path_stat = os.lstat(path)
        except OSError as error:
            raise SourceReadProblem(
                "page/source-changed",
                f"published Markdown path changed after open: {error}",
            ) from error
        if not stat.S_ISREG(path_stat.st_mode):
            raise SourceReadProblem(
                "page/nonregular-file",
                "published Markdown source path must be a regular non-symlink file",
            )
        if (path_stat.st_dev, path_stat.st_ino) != (
            descriptor_stat.st_dev,
            descriptor_stat.st_ino,
        ):
            raise SourceReadProblem(
                "page/source-changed",
                "published Markdown path changed while it was being opened",
            )
        if descriptor_stat.st_size > MAX_FILE_BYTES:
            raise SourceReadProblem(
                "page/too-large", f"source file exceeds {MAX_FILE_BYTES} bytes"
            )

        payload = bytearray()
        while len(payload) <= MAX_FILE_BYTES:
            try:
                chunk = os.read(
                    descriptor,
                    min(READ_CHUNK_BYTES, MAX_FILE_BYTES + 1 - len(payload)),
                )
            except OSError as error:
                raise SourceReadProblem(
                    "page/read-failed", f"could not read opened source: {error}"
                ) from error
            if not chunk:
                break
            payload.extend(chunk)
        if len(payload) > MAX_FILE_BYTES:
            raise SourceReadProblem(
                "page/too-large", f"source file exceeds {MAX_FILE_BYTES} bytes"
            )
        try:
            text = payload.decode("utf-8-sig")
        except UnicodeError as error:
            raise SourceReadProblem(
                "page/read-failed", f"could not decode UTF-8 source: {error}"
            ) from error
        source_lines = max(1, len(text.splitlines()))
        if source_lines > MAX_SOURCE_LINES:
            raise SourceReadProblem(
                "page/line-limit",
                f"source file exceeds the {MAX_SOURCE_LINES}-line DoS/resource bound",
            )
        return text, len(payload)
    finally:
        try:
            os.close(descriptor)
        except OSError:
            pass


def _bounded_site_files(site_root: Path) -> tuple[str, ...]:
    """Inventory a built site without following aliases or special files."""

    try:
        root_stat = site_root.lstat()
    except OSError as error:
        raise InventoryProblem(
            "site/inventory-read-failed",
            "site/",
            f"could not stat built-site root: {error}",
        ) from error
    if stat.S_ISLNK(root_stat.st_mode):
        raise InventoryProblem(
            "site/inventory-symlink",
            "site/",
            "built-site root must not be a symbolic link",
        )
    if not stat.S_ISDIR(root_stat.st_mode):
        raise InventoryProblem(
            "site/root-missing",
            "site/",
            "built-site root must be a directory",
        )

    root_identity = (root_stat.st_dev, root_stat.st_ino)
    seen_directories = {root_identity}
    pending: list[tuple[Path, str, int, frozenset[tuple[int, int]]]] = [
        (site_root, ".", 0, frozenset({root_identity}))
    ]
    entries_seen = 0
    directories_seen = 1
    files: list[str] = []

    while pending:
        directory, relative_dir, depth, ancestors = pending.pop()
        child_directories: list[tuple[str, Path, tuple[int, int]]] = []
        try:
            with os.scandir(directory) as entries:
                for entry in entries:
                    entries_seen += 1
                    if entries_seen > MAX_INVENTORY_ENTRIES:
                        raise InventoryProblem(
                            "site/inventory-entry-limit",
                            "site/",
                            f"built site exceeds {MAX_INVENTORY_ENTRIES} filesystem entries",
                        )
                    relative = (
                        entry.name
                        if relative_dir == "."
                        else f"{relative_dir}/{entry.name}"
                    )
                    try:
                        entry_stat = entry.stat(follow_symlinks=False)
                    except OSError as error:
                        raise InventoryProblem(
                            "site/inventory-read-failed",
                            relative,
                            f"could not inspect built-site entry: {error}",
                        ) from error
                    if stat.S_ISLNK(entry_stat.st_mode):
                        raise InventoryProblem(
                            "site/inventory-symlink",
                            relative,
                            "built-site entries must not be symbolic links",
                        )
                    if stat.S_ISDIR(entry_stat.st_mode):
                        child_directories.append(
                            (
                                entry.name,
                                Path(entry.path),
                                (entry_stat.st_dev, entry_stat.st_ino),
                            )
                        )
                    elif stat.S_ISREG(entry_stat.st_mode):
                        files.append(relative)
                    else:
                        raise InventoryProblem(
                            "site/inventory-nonregular-file",
                            relative,
                            "built-site entries must be regular files or directories",
                        )
        except InventoryProblem:
            raise
        except OSError as error:
            raise InventoryProblem(
                "site/inventory-read-failed",
                "site/" if relative_dir == "." else relative_dir,
                f"could not traverse built-site directory: {error}",
            ) from error

        children: list[tuple[Path, str, int, frozenset[tuple[int, int]]]] = []
        for name, child_path, identity in sorted(child_directories):
            relative = name if relative_dir == "." else f"{relative_dir}/{name}"
            if identity in ancestors:
                raise InventoryProblem(
                    "site/inventory-directory-cycle",
                    relative,
                    "built-site directory graph contains an ancestor cycle",
                )
            if identity in seen_directories:
                raise InventoryProblem(
                    "site/inventory-directory-alias",
                    relative,
                    "multiple built-site paths resolve to the same directory",
                )
            child_depth = depth + 1
            if child_depth > MAX_INVENTORY_DEPTH:
                raise InventoryProblem(
                    "site/inventory-depth-limit",
                    relative,
                    f"built-site directory depth exceeds {MAX_INVENTORY_DEPTH}",
                )
            directories_seen += 1
            if directories_seen > MAX_INVENTORY_DIRECTORIES:
                raise InventoryProblem(
                    "site/inventory-directory-limit",
                    "site/",
                    f"built site exceeds {MAX_INVENTORY_DIRECTORIES} directories",
                )
            seen_directories.add(identity)
            children.append(
                (
                    child_path,
                    relative,
                    child_depth,
                    ancestors | {identity},
                )
            )
        pending.extend(reversed(children))

    return tuple(sorted(files))


def _read_bounded_site_html(path: Path) -> tuple[str, int]:
    flags = os.O_RDONLY
    for flag_name in ("O_BINARY", "O_CLOEXEC", "O_NOFOLLOW", "O_NONBLOCK"):
        flags |= int(getattr(os, flag_name, 0))
    try:
        descriptor = os.open(path, flags)
    except OSError as error:
        if error.errno in {errno.ELOOP, errno.EMLINK, errno.ENXIO}:
            raise SiteCrawlProblem(
                "site/html-nonregular",
                "built HTML must be a regular non-symlink file",
            ) from error
        raise SiteCrawlProblem(
            "site/html-read-failed", f"could not open built HTML: {error}"
        ) from error

    try:
        try:
            descriptor_stat = os.fstat(descriptor)
        except OSError as error:
            raise SiteCrawlProblem(
                "site/html-read-failed", f"could not inspect built HTML: {error}"
            ) from error
        if not stat.S_ISREG(descriptor_stat.st_mode):
            raise SiteCrawlProblem(
                "site/html-nonregular", "built HTML must be a regular file"
            )
        try:
            path_stat = os.lstat(path)
        except OSError as error:
            raise SiteCrawlProblem(
                "site/html-changed", f"built HTML path changed after open: {error}"
            ) from error
        if not stat.S_ISREG(path_stat.st_mode):
            raise SiteCrawlProblem(
                "site/html-nonregular",
                "built HTML path must be a regular non-symlink file",
            )
        if (path_stat.st_dev, path_stat.st_ino) != (
            descriptor_stat.st_dev,
            descriptor_stat.st_ino,
        ):
            raise SiteCrawlProblem(
                "site/html-changed", "built HTML path changed while it was opened"
            )
        if descriptor_stat.st_size > MAX_SITE_HTML_BYTES:
            raise SiteCrawlProblem(
                "site/html-too-large",
                f"built HTML exceeds {MAX_SITE_HTML_BYTES} bytes",
            )

        payload = bytearray()
        while len(payload) <= MAX_SITE_HTML_BYTES:
            try:
                chunk = os.read(
                    descriptor,
                    min(
                        READ_CHUNK_BYTES,
                        MAX_SITE_HTML_BYTES + 1 - len(payload),
                    ),
                )
            except OSError as error:
                raise SiteCrawlProblem(
                    "site/html-read-failed", f"could not read built HTML: {error}"
                ) from error
            if not chunk:
                break
            payload.extend(chunk)
        if len(payload) > MAX_SITE_HTML_BYTES:
            raise SiteCrawlProblem(
                "site/html-too-large",
                f"built HTML exceeds {MAX_SITE_HTML_BYTES} bytes",
            )
        try:
            return payload.decode("utf-8-sig"), len(payload)
        except UnicodeError as error:
            raise SiteCrawlProblem(
                "site/html-read-failed", f"could not decode UTF-8 HTML: {error}"
            ) from error
    finally:
        try:
            os.close(descriptor)
        except OSError:
            pass


def _parse_site_page(
    path: str, text: str, collector: _IssueCollector
) -> _SitePage | None:
    try:
        document = html5lib.parse(text)
    except Exception as error:
        collector.add(
            "site/html-parse-failed",
            path,
            f"html5lib document parsing failed: {type(error).__name__}: {error}",
        )
        return None

    count, depth = _dom_size(document)
    if count > MAX_DOM_NODES:
        collector.add(
            "site/dom-node-limit",
            path,
            f"built HTML DOM exceeds {MAX_DOM_NODES} nodes",
        )
        return None
    if depth > MAX_DOM_DEPTH:
        collector.add(
            "site/dom-depth-limit",
            path,
            f"built HTML DOM exceeds depth {MAX_DOM_DEPTH}",
        )
        return None

    id_counts: Counter[str] = Counter()
    fragment_targets: set[str] = set()
    destinations: list[_SiteDestination] = []
    base_href: str | None = None
    try:
        for element in document.iter():
            if _tag(element) == "#comment":
                continue
            if "id" in element.attrib:
                element_id = element.attrib["id"]
                id_counts[element_id] += 1
                fragment_targets.add(element_id)
            if _tag(element) == "a" and "name" in element.attrib:
                fragment_targets.add(element.attrib["name"])
            for attribute, value in sorted(element.attrib.items()):
                local_attribute = _attribute_local_name(attribute)
                if local_attribute not in RESOURCE_ATTRIBUTES:
                    continue
                resource_name = _resource_attribute_name(attribute)
                kind = f"{_tag(element)}:{resource_name}"
                if _tag(element) == "base" and local_attribute == "href":
                    if base_href is None:
                        base_href = value
                if local_attribute == "srcset":
                    for candidate, descriptor in _parse_srcset_candidates(value):
                        destination_kind = f"{kind}[{descriptor or 'default'}]"
                        destinations.append(
                            _SiteDestination(
                                len(destinations) + 1,
                                destination_kind,
                                candidate,
                            )
                        )
                else:
                    destinations.append(
                        _SiteDestination(len(destinations) + 1, kind, value)
                    )
                if len(destinations) > MAX_RESOURCE_DESTINATIONS:
                    raise SiteCrawlProblem(
                        "site/destination-limit",
                        "built HTML destination count exceeds "
                        f"{MAX_RESOURCE_DESTINATIONS}",
                    )
    except SiteCrawlProblem as error:
        collector.add(error.rule_id, path, str(error))
        return None
    except Exception as error:
        collector.add(
            "site/html-model-failed",
            path,
            f"could not inspect built HTML DOM: {type(error).__name__}: {error}",
        )
        return None

    for duplicate in sorted(value for value, amount in id_counts.items() if amount > 1):
        collector.add(
            "site/duplicate-id",
            path,
            f"built HTML contains duplicate id {duplicate!r}",
            excerpt=duplicate,
        )
    return _SitePage(
        path=path,
        fragment_targets=frozenset(fragment_targets),
        destinations=tuple(destinations),
        base_href=base_href,
    )


_EXPLICIT_URL_SCHEME = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*:")


def _effective_http_port(scheme: str, explicit_port: int | None) -> int:
    if explicit_port is not None:
        return explicit_port
    return 443 if scheme == "https" else 80


def _configured_site_location(
    config_path: str | Path, collector: _IssueCollector
) -> _SiteLocation | None:
    path = Path(config_path).resolve()
    try:
        config = load_config(config_file=str(path))
    except Exception as error:
        collector.add(
            "config/load-failed",
            path.name,
            f"could not load MkDocs configuration: {type(error).__name__}: {error}",
        )
        return None

    site_url = str(config.site_url or "")
    try:
        parsed = urllib.parse.urlsplit(site_url)
        explicit_port = parsed.port
    except ValueError as error:
        collector.add(
            "config/unsupported-site-url",
            path.name,
            f"configured site_url is invalid: {error}",
            excerpt=site_url,
        )
        return None
    scheme = parsed.scheme.casefold()
    if (
        scheme not in {"http", "https"}
        or parsed.hostname is None
        or parsed.query
        or parsed.fragment
        or not parsed.path.startswith("/")
    ):
        collector.add(
            "config/unsupported-site-url",
            path.name,
            "configured site_url must be an absolute HTTP(S) URL without a query or fragment",
            excerpt=site_url,
        )
        return None

    decoded_path = parsed.path
    for _ in range(3):
        expanded = urllib.parse.unquote(decoded_path, errors="replace")
        if expanded == decoded_path:
            break
        decoded_path = expanded
    if (
        "\\" in decoded_path
        or any(
            unicodedata.category(character) in {"Cc", "Cf", "Cs", "Co", "Cn"}
            for character in decoded_path
        )
    ):
        collector.add(
            "config/unsupported-site-url",
            path.name,
            "configured site_url path contains a prohibited character",
            excerpt=site_url,
        )
        return None

    normalized_path = posixpath.normpath(decoded_path)
    if normalized_path in {"", ".", "/"}:
        path_prefix = "/"
    else:
        path_prefix = f"/{normalized_path.strip('/')}/"
    return _SiteLocation(
        scheme=scheme,
        hostname=parsed.hostname.casefold(),
        port=_effective_http_port(scheme, explicit_port),
        path_prefix=path_prefix,
    )


def _is_same_site_origin(
    parsed: urllib.parse.SplitResult, site_location: _SiteLocation
) -> bool:
    scheme = parsed.scheme.casefold() or site_location.scheme
    if scheme not in {"http", "https"} or parsed.hostname is None:
        return False
    try:
        port = _effective_http_port(scheme, parsed.port)
    except ValueError:
        return False
    return (
        scheme == site_location.scheme
        and parsed.hostname.casefold() == site_location.hostname
        and port == site_location.port
    )


def _resolve_site_url(
    base_path: str,
    value: str,
    *,
    site_location: _SiteLocation,
    base_is_external: bool = False,
) -> _SiteUrl | None:
    candidate = value.strip(" \t\n\r\f")
    candidate_with_slashes = candidate.replace("\\", "/")
    explicit_scheme = _EXPLICIT_URL_SCHEME.match(candidate_with_slashes) is not None
    network_path = candidate_with_slashes.startswith("//")
    try:
        parsed = urllib.parse.urlsplit(candidate_with_slashes)
    except ValueError as error:
        if explicit_scheme or network_path:
            return None
        raise SiteCrawlProblem(
            "site/invalid-target", f"could not parse local URL: {error}"
        ) from error

    origin_qualified = explicit_scheme or network_path
    if origin_qualified:
        if not _is_same_site_origin(parsed, site_location):
            return None
    elif parsed.scheme or parsed.netloc:
        return None
    elif base_is_external:
        return None

    if re.search(r"%(?![0-9A-Fa-f]{2})", candidate_with_slashes) is not None:
        raise SiteCrawlProblem(
            "site/invalid-target", "local URL contains an invalid percent escape"
        )
    if any(
        unicodedata.category(character) in {"Cc", "Cf", "Cs", "Co", "Cn"}
        for character in candidate_with_slashes
    ):
        raise SiteCrawlProblem(
            "site/invalid-target", "local URL contains a prohibited character"
        )

    decoded_path = parsed.path
    for _ in range(3):
        expanded = urllib.parse.unquote(decoded_path, errors="replace")
        if expanded == decoded_path:
            break
        decoded_path = expanded
    if len(decoded_path) > MAX_PATH:
        raise SiteCrawlProblem(
            "site/invalid-target",
            f"decoded local URL path exceeds {MAX_PATH} characters",
        )
    if any(
        unicodedata.category(character) in {"Cc", "Cf", "Cs", "Co", "Cn"}
        for character in decoded_path
    ):
        raise SiteCrawlProblem(
            "site/invalid-target",
            "decoded local URL path contains a prohibited character",
        )

    absolute_reference = origin_qualified or decoded_path.startswith("/")
    if origin_qualified and not decoded_path:
        decoded_path = "/"
    if not decoded_path:
        resolved_path = base_path
    else:
        trailing_slash = decoded_path.endswith("/")
        if absolute_reference:
            prefix = site_location.path_prefix
            prefix_root = prefix.rstrip("/") or "/"
            if decoded_path == prefix_root:
                combined = ""
            elif decoded_path.startswith(prefix):
                combined = decoded_path[len(prefix) :]
            else:
                raise SiteCrawlProblem(
                    "site/outside-target",
                    "same-origin or root URL is outside the configured site_url path prefix",
                )
        else:
            base_directory = (
                base_path if base_path.endswith("/") else posixpath.dirname(base_path)
            )
            combined = posixpath.join(base_directory, decoded_path)
        normalized = posixpath.normpath(combined)
        if normalized == ".":
            normalized = ""
        if normalized == ".." or normalized.startswith("../"):
            raise SiteCrawlProblem(
                "site/outside-target",
                "local URL escapes the built-site root",
            )
        resolved_path = (
            f"{normalized}/" if trailing_slash and normalized else normalized
        )

    fragment = None
    if "#" in candidate_with_slashes:
        fragment = urllib.parse.unquote(parsed.fragment, errors="replace")
    return _SiteUrl(resolved_path, fragment)


def _site_target_file(path: str, files: frozenset[str]) -> str | None:
    if not path or path.endswith("/"):
        candidate = f"{path}index.html"
        return candidate if candidate in files else None
    if path in files:
        return path
    index_candidate = f"{path}/index.html"
    return index_candidate if index_candidate in files else None


def _validate_site_destinations(
    page: _SitePage,
    pages: Mapping[str, _SitePage],
    files: frozenset[str],
    site_location: _SiteLocation,
    collector: _IssueCollector,
) -> None:
    base_path = page.path
    base_is_external = False
    if page.base_href is not None:
        try:
            resolved_base = _resolve_site_url(
                page.path, page.base_href, site_location=site_location
            )
        except SiteCrawlProblem as error:
            collector.add(
                error.rule_id,
                page.path,
                f"invalid base href: {error}",
                excerpt=page.base_href,
            )
            base_is_external = True
        else:
            if resolved_base is None:
                base_is_external = True
            else:
                base_path = resolved_base.path

    for destination in page.destinations:
        destination_base = (
            page.path if destination.kind == "base:href" else base_path
        )
        try:
            resolved = _resolve_site_url(
                destination_base,
                destination.value,
                site_location=site_location,
                base_is_external=(
                    base_is_external and destination.kind != "base:href"
                ),
            )
        except SiteCrawlProblem as error:
            collector.add(
                error.rule_id,
                page.path,
                f"{destination.kind} has an invalid local target: {error}",
                rendered_ordinal=destination.ordinal,
                excerpt=destination.value,
            )
            continue
        if resolved is None:
            continue

        target_file = _site_target_file(resolved.path, files)
        if target_file is None:
            collector.add(
                "site/target-missing",
                page.path,
                f"{destination.kind} local target does not exist inside the built site",
                rendered_ordinal=destination.ordinal,
                excerpt=destination.value,
            )
            continue
        if resolved.fragment in {None, ""}:
            continue
        target_page = pages.get(target_file)
        if (
            target_page is None
            or resolved.fragment not in target_page.fragment_targets
        ):
            collector.add(
                "site/fragment-missing",
                page.path,
                f"{destination.kind} fragment does not exist in {target_file}",
                rendered_ordinal=destination.ordinal,
                excerpt=destination.value,
            )


def validate_built_site(
    site_root: str | Path,
    *,
    config_path: str | Path = DEFAULT_CONFIG_PATH,
) -> SiteCheckResult:
    """Crawl bounded built output using the configured ``site_url`` origin."""

    collector = _IssueCollector()
    site_location = _configured_site_location(config_path, collector)
    if site_location is None:
        return SiteCheckResult(0, collector.finish())
    root = Path(os.path.abspath(os.fspath(site_root)))
    try:
        inventory = _bounded_site_files(root)
    except InventoryProblem as error:
        collector.add(error.rule_id, error.path, str(error))
        return SiteCheckResult(0, collector.finish())

    all_files = frozenset(inventory)
    html_files = tuple(
        path for path in inventory if PurePosixPath(path).suffix.casefold() == ".html"
    )
    if len(html_files) > MAX_SITE_HTML_FILES:
        collector.add(
            "site/html-file-limit",
            "site/",
            f"built site exceeds {MAX_SITE_HTML_FILES} HTML files",
        )
        return SiteCheckResult(len(html_files), collector.finish())
    if not html_files:
        collector.add(
            "site/no-html",
            "site/",
            "built site contains no HTML files",
        )
        return SiteCheckResult(0, collector.finish())

    pages: dict[str, _SitePage] = {}
    total_html_bytes = 0
    destinations_seen = 0
    for relative in html_files:
        file_path = root.joinpath(*PurePosixPath(relative).parts)
        try:
            text, actual_size = _read_bounded_site_html(file_path)
        except SiteCrawlProblem as error:
            collector.add(error.rule_id, relative, str(error))
            continue
        total_html_bytes += actual_size
        if total_html_bytes > MAX_TOTAL_SITE_HTML_BYTES:
            collector.add(
                "site/html-byte-limit",
                "site/",
                "total built HTML exceeds "
                f"{MAX_TOTAL_SITE_HTML_BYTES} bytes",
            )
            return SiteCheckResult(len(html_files), collector.finish())
        page = _parse_site_page(relative, text, collector)
        if page is None:
            continue
        destinations_seen += len(page.destinations)
        if destinations_seen > MAX_RESOURCE_DESTINATIONS:
            collector.add(
                "site/destination-limit",
                "site/",
                "built-site destination count exceeds "
                f"{MAX_RESOURCE_DESTINATIONS}",
            )
            return SiteCheckResult(len(html_files), collector.finish())
        pages[relative] = page

    for relative in sorted(pages):
        _validate_site_destinations(
            pages[relative], pages, all_files, site_location, collector
        )

    return SiteCheckResult(len(html_files), collector.finish())


def validate_documentation_root(
    docs_root: str | Path | None = None,
    *,
    config_path: str | Path = DEFAULT_CONFIG_PATH,
) -> CheckResult:
    """Validate one docs tree against its locked MkDocs renderer profile."""

    profile, config_issues = load_renderer_profile(config_path)
    if profile is None:
        return CheckResult(pair_count=0, issues=config_issues)

    collector = _IssueCollector()
    root = (
        Path(os.path.abspath(os.fspath(docs_root)))
        if docs_root is not None
        else profile.docs_dir
    )
    published: list[Path] = []
    try:
        # Use MkDocs File, exclusion, and README/index semantics around a
        # bounded filesystem walk; MkDocs' own get_files follows symlinks
        # without cycle detection.
        inventory_config = load_config(
            config_file=str(profile.config_path), docs_dir=str(root)
        )
        inventory_config = inventory_config.plugins.on_config(inventory_config)
        mkdocs_files = _bounded_mkdocs_files(inventory_config)
        for file in mkdocs_files.documentation_pages(
            inclusion=InclusionLevel.is_included
        ):
            published.append(root.joinpath(*PurePosixPath(str(file.src_uri)).parts))
    except InventoryProblem as error:
        collector.add(error.rule_id, error.path, str(error))
        return CheckResult(0, collector.finish())
    except Exception as error:
        collector.add(
            "inventory/read-failed",
            "docs/",
            f"could not inventory documentation root through MkDocs: {type(error).__name__}: {error}",
        )
        return CheckResult(0, collector.finish())
    published.sort(key=lambda item: item.relative_to(root).as_posix())
    if len(published) > MAX_PUBLISHED_FILES:
        collector.add(
            "inventory/file-limit",
            "docs/",
            f"published Markdown file count exceeds {MAX_PUBLISHED_FILES}",
        )
        return CheckResult(0, collector.finish())

    canonical_files: list[str] = []
    localized_files: dict[str, list[str]] = {
        locale: [] for locale in profile.nondefault_locales
    }
    valid_md_paths: list[str] = []
    for file_path in published:
        relative = file_path.relative_to(root).as_posix()
        if file_path.suffix != CANONICAL_SUFFIX:
            collector.add(
                "inventory/noncanonical-markdown",
                relative,
                f"MkDocs publishes {file_path.suffix} files, but project pages must be renamed to .md",
            )
            continue
        valid_md_paths.append(relative)
        locale = _localized_locale(relative, profile.nondefault_locales)
        if locale is None:
            canonical_files.append(relative)
        else:
            localized_files[locale].append(relative)

    file_set = set(valid_md_paths)
    pairs: list[tuple[str, str, str]] = []
    for canonical in canonical_files:
        for locale in profile.nondefault_locales:
            localized = _localized_path(canonical, locale)
            if localized not in file_set:
                collector.add(
                    "inventory/missing-locale",
                    canonical,
                    f"missing enabled locale sibling {localized}",
                )
            else:
                pairs.append((canonical, localized, locale))
    for locale, paths in localized_files.items():
        suffix = f".{locale}{CANONICAL_SUFFIX}"
        for localized in paths:
            canonical = f"{localized[: -len(suffix)]}{CANONICAL_SUFFIX}"
            if canonical not in file_set:
                collector.add(
                    "inventory/orphan-locale",
                    localized,
                    f"orphan localized page; add canonical sibling {canonical}",
                )

    if not pairs:
        collector.add(
            "inventory/no-pairs",
            "docs/",
            "no complete canonical/enabled-locale Markdown pairs were found",
        )

    pages: dict[str, ParsedPage] = {}
    canonical_set = set(canonical_files)
    total_source_bytes = 0
    for relative in valid_md_paths:
        file_path = root.joinpath(*PurePosixPath(relative).parts)
        try:
            text, actual_size = _read_bounded_source(file_path)
        except SourceReadProblem as error:
            collector.add(error.rule_id, relative, str(error))
            pages[relative] = ParsedPage(relative, None, None, None, False)
            continue
        total_source_bytes += actual_size
        if total_source_bytes > MAX_TOTAL_SOURCE_BYTES:
            collector.add(
                "inventory/byte-limit",
                "docs/",
                f"total published Markdown source exceeds {MAX_TOTAL_SOURCE_BYTES} bytes",
            )
            return CheckResult(len(pairs), collector.finish())
        if not text.strip():
            collector.add(
                "page/empty",
                relative,
                "documentation page is empty",
                source_line=1,
            )
        body, metadata, metadata_mapping, has_yaml = _split_frontmatter(
            relative, text, collector
        )
        if relative in canonical_set and relative.startswith("notes/"):
            _validate_note_metadata(
                relative, metadata_mapping, has_yaml, collector
            )
        model = _render_page(relative, body, profile, collector) if body is not None else None
        if body is not None and not body.strip():
            collector.add(
                "page/empty-body",
                relative,
                "documentation page body is empty after metadata",
                source_line=1,
            )
        if model is not None:
            _validate_page_policy(
                model, profile.nondefault_locales, collector
            )
        pages[relative] = ParsedPage(
            relative,
            metadata,
            body,
            model,
            has_yaml,
        )

    models = {
        path: page.model for path, page in pages.items() if page.model is not None
    }
    for canonical, localized, locale in pairs:
        english = pages.get(canonical)
        translation = pages.get(localized)
        if english is not None and translation is not None:
            _compare_pair(
                english,
                translation,
                locale,
                models,
                collector,
            )

    return CheckResult(pair_count=len(pairs), issues=collector.finish())


# Backwards-readable aliases for callers and fixtures.
check_documentation = validate_documentation_root


def run_documentation_check(
    docs_root: str | Path | None = None,
    *,
    config_path: str | Path = DEFAULT_CONFIG_PATH,
    stdout: Any = sys.stdout,
    stderr: Any = sys.stderr,
) -> int:
    result = validate_documentation_root(docs_root, config_path=config_path)
    noun = "pair" if result.pair_count == 1 else "pairs"
    if result.issues:
        stdout.write(f"Checked {result.pair_count} complete documentation locale {noun}.\n")
        stderr.write(
            f"Documentation validation failed with {len(result.issues)} "
            f"{'issue' if len(result.issues) == 1 else 'issues'}:\n"
        )
        for issue in result.issues:
            stderr.write(f"- {issue.format()}\n")
        return 1
    stdout.write(
        f"Validated {result.pair_count} documentation locale {noun}; {CONTRACT}\n"
    )
    return 0


def run_built_site_check(
    site_root: str | Path,
    *,
    config_path: str | Path = DEFAULT_CONFIG_PATH,
    stdout: Any = sys.stdout,
    stderr: Any = sys.stderr,
) -> int:
    result = validate_built_site(site_root, config_path=config_path)
    noun = "file" if result.html_file_count == 1 else "files"
    if result.issues:
        stdout.write(f"Crawled {result.html_file_count} built HTML {noun}.\n")
        stderr.write(
            f"Built-site validation failed with {len(result.issues)} "
            f"{'issue' if len(result.issues) == 1 else 'issues'}:\n"
        )
        for issue in result.issues:
            stderr.write(f"- {issue.format()}\n")
        return 1
    stdout.write(
        f"Validated {result.html_file_count} built HTML {noun}; local targets, "
        "resources, fragments, and IDs are internally consistent.\n"
    )
    return 0


def _argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=CONTRACT,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--config-file",
        default=str(DEFAULT_CONFIG_PATH),
        help="MkDocs configuration to load (default: repository mkdocs.yml)",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--docs-dir",
        "--docs-root",
        dest="docs_dir",
        help="documentation root override (default: normalized MkDocs docs_dir)",
    )
    mode.add_argument(
        "--site-dir",
        help=(
            "crawl an already-built site directory with html5lib instead of "
            "checking documentation sources"
        ),
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    arguments = _argument_parser().parse_args(argv)
    if arguments.site_dir is not None:
        return run_built_site_check(
            arguments.site_dir,
            config_path=arguments.config_file,
        )
    return run_documentation_check(
        arguments.docs_dir,
        config_path=arguments.config_file,
    )


if __name__ == "__main__":
    raise SystemExit(main())
