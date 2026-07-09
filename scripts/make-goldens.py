#!/usr/bin/env python3
"""Builds the golden-test XLSForms and converts them with pyxform.

Run with:  uv run --with openpyxl --with pyxform scripts/make-goldens.py

Writes workbooks to tests/golden/src/*.xlsx and pyxform's XForm output to
tests/golden/expected/*.xml. The pyxform version used is recorded in
tests/golden/README.md. Regenerating goldens is a deliberate, reviewed act.
"""
from pathlib import Path

import openpyxl
from pyxform import __version__ as pyxform_version
from pyxform.xls2xform import convert

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tests" / "golden" / "src"
EXPECTED = ROOT / "tests" / "golden" / "expected"


def make_workbook(path: Path, sheets: dict[str, list[list[str]]]) -> None:
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    for name, rows in sheets.items():
        ws = wb.create_sheet(title=name)
        for row in rows:
            ws.append(row)
    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)


FORMS: dict[str, dict[str, list[list[str]]]] = {
    "basic": {
        "survey": [
            ["type", "name", "label", "hint", "required", "relevant", "constraint",
             "constraint_message", "calculation", "default", "appearance"],
            ["text", "respondent_name", "What is your name?", "Full legal name",
             "yes", "", "string-length(.) > 1", "Name is too short", "", "", ""],
            ["integer", "age", "How old are you?", "", "yes", "", ". >= 0 and . <= 120",
             "Age must be 0-120", "", "", "thousands-sep"],
            ["decimal", "height", "Height in meters", "", "", "${age} >= 18", "", "", "", "1.5", ""],
            ["note", "intro_note", "Thank you ${respondent_name}!", "", "", "", "", "", "", "", ""],
            ["calculate", "birth_year", "", "", "", "", "", "", "2026 - ${age}", "", ""],
            ["date", "visit_date", "Date of visit", "", "", "", "", "", "", "today()", ""],
            ["select_one yes_no", "consent", "Do you consent?", "", "yes", "", "", "", "", "", ""],
            ["select_multiple symptoms", "symptoms", "Any symptoms?", "", "", "", "", "", "", "", "minimal"],
        ],
        "choices": [
            ["list_name", "name", "label"],
            ["yes_no", "yes", "Yes"],
            ["yes_no", "no", "No"],
            ["symptoms", "fever", "Fever"],
            ["symptoms", "cough", "Cough"],
            ["symptoms", "none", "None"],
        ],
        "settings": [
            ["form_title", "form_id", "version"],
            ["Basic Test", "basic_test", "20260709"],
        ],
    },
    "structure": {
        "survey": [
            ["type", "name", "label", "appearance", "repeat_count", "relevant"],
            ["begin_group", "hh", "Household", "field-list", "", ""],
            ["text", "address", "Address", "", "", ""],
            ["begin_group", "gps_meta", "Location details", "", "", ""],
            ["geopoint", "location", "Where is the house?", "", "", ""],
            ["end_group", "", "", "", "", ""],
            ["end_group", "", "", "", "", ""],
            ["integer", "num_members", "How many members?", "", "", ""],
            ["begin_repeat", "member", "Household member", "", "${num_members}", ""],
            ["text", "member_name", "Member name", "", "", ""],
            ["integer", "member_age", "Member age", "", "", ""],
            ["text", "school", "School name", "", "", "${member_age} >= 5"],
            ["end_repeat", "", "", "", "", ""],
        ],
        "settings": [
            ["form_title", "form_id", "version"],
            ["Structure Test", "structure_test", "20260709"],
        ],
    },
    "translated": {
        "survey": [
            ["type", "name", "label::English (en)", "label::Français (fr)",
             "hint::English (en)", "hint::Français (fr)", "image::English (en)",
             "constraint", "constraint_message::English (en)", "constraint_message::Français (fr)"],
            ["text", "name", "Your name?", "Votre nom ?", "As in the ID", "Comme sur la carte",
             "", "", "", ""],
            ["integer", "age", "Your age?", "Votre âge ?", "", "", "age.png",
             ". > 0", "Must be positive", "Doit être positif"],
            ["select_one colors", "color", "Favourite color?", "Couleur préférée ?", "", "", "", "", "", ""],
        ],
        "choices": [
            ["list_name", "name", "label::English (en)", "label::Français (fr)", "image::English (en)"],
            ["colors", "red", "Red", "Rouge", "red.png"],
            ["colors", "blue", "Blue", "Bleu", ""],
        ],
        "settings": [
            ["form_title", "form_id", "version", "default_language"],
            ["Translated Test", "translated_test", "20260709", "English (en)"],
        ],
    },
    "cascade": {
        "survey": [
            ["type", "name", "label", "choice_filter", "parameters"],
            ["select_one state", "state", "State?", "", ""],
            ["select_one district", "district", "District?", "state=${state}", ""],
            ["select_one_from_file villages.csv", "village", "Village?", "", ""],
            ["select_one colors", "shuffled", "Random color?", "", "randomize=true, seed=42"],
        ],
        "choices": [
            ["list_name", "name", "label", "state"],
            ["state", "north", "North", ""],
            ["state", "south", "South", ""],
            ["district", "n1", "North One", "north"],
            ["district", "n2", "North Two", "north"],
            ["district", "s1", "South One", "south"],
            ["colors", "red", "Red", ""],
            ["colors", "blue", "Blue", ""],
        ],
        "settings": [
            ["form_title", "form_id", "version"],
            ["Cascade Test", "cascade_test", "20260709"],
        ],
    },
    "widgets": {
        "survey": [
            ["type", "name", "label", "parameters", "appearance"],
            ["start", "start", "", "", ""],
            ["end", "end", "", "", ""],
            ["today", "today", "", "", ""],
            ["deviceid", "deviceid", "", "", ""],
            ["audit", "audit", "", "location-priority=balanced location-min-interval=60 location-max-age=120", ""],
            ["start-geopoint", "start_location", "", "", ""],
            ["background-audio", "recording", "", "quality=low", ""],
            ["range", "rating", "Rate 1-10", "start=1 end=10 step=1", "rating"],
            ["range", "weight", "Weight", "start=0.5 end=5.0 step=0.5", ""],
            ["rank priorities", "priorities", "Rank your priorities", "", ""],
            ["geotrace", "path", "Walk the path", "", ""],
            ["geoshape", "plot", "Outline the plot", "", ""],
            ["image", "photo", "Take a photo", "max-pixels=1024", ""],
            ["audio", "sound", "Record a sound", "quality=voice-only", ""],
            ["video", "clip", "Record a clip", "", ""],
            ["file", "doc", "Attach a document", "", ""],
            ["barcode", "code", "Scan the code", "", ""],
            ["acknowledge", "ack", "I have read the terms", "", ""],
            ["datetime", "appointment", "Appointment", "", ""],
            ["time", "wake_time", "Wake-up time", "", ""],
        ],
        "choices": [
            ["list_name", "name", "label"],
            ["priorities", "health", "Health"],
            ["priorities", "school", "School"],
            ["priorities", "roads", "Roads"],
        ],
        "settings": [
            ["form_title", "form_id", "version"],
            ["Widgets Test", "widgets_test", "20260709"],
        ],
    },
    "entities": {
        "survey": [
            ["type", "name", "label", "save_to"],
            ["text", "hh_name", "Household name", "household_name"],
            ["geopoint", "hh_location", "Household location", "geometry"],
        ],
        "entities": [
            ["list_name", "label"],
            ["households", "${hh_name}"],
        ],
        "settings": [
            ["form_title", "form_id", "version"],
            ["Entities Test", "entities_test", "20260709"],
        ],
    },
    "defaults_trigger": {
        "survey": [
            ["type", "name", "label", "default", "trigger", "calculation"],
            ["integer", "price", "Price?", "", "", ""],
            ["integer", "quantity", "Quantity?", "1", "", ""],
            ["decimal", "total", "Total (edit if needed)", "", "${price}", "${price} * ${quantity}"],
            ["date", "delivery", "Delivery date", "today()", "", ""],
        ],
        "settings": [
            ["form_title", "form_id", "version"],
            ["Defaults Test", "defaults_test", "20260709"],
        ],
    },
    "submission": {
        "survey": [
            ["type", "name", "label"],
            ["text", "comment", "Any comments?"],
        ],
        "settings": [
            ["form_title", "form_id", "version", "instance_name", "style", "submission_url", "public_key"],
            ["Submission Test", "submission_test", "20260709", "concat('c-', ${comment})", "pages",
             "https://example.org/submission", "MIIBIjANBgkq"],
        ],
    },
}


def main() -> None:
    EXPECTED.mkdir(parents=True, exist_ok=True)
    for name, sheets in FORMS.items():
        xlsx = SRC / f"{name}.xlsx"
        make_workbook(xlsx, sheets)
        result = convert(xlsform=str(xlsx))
        (EXPECTED / f"{name}.xml").write_text(result.xform, encoding="utf-8")
        print(f"✔ {name}: {len(result.xform)} bytes"
              + (f" — warnings: {result.warnings}" if result.warnings else ""))

    readme = ROOT / "tests" / "golden" / "README.md"
    readme.write_text(
        "# Golden files\n\n"
        f"Generated by scripts/make-goldens.py with **pyxform {pyxform_version}**.\n\n"
        "`src/*.xlsx` are the XLSForm fixtures; `expected/*.xml` is pyxform's\n"
        "output for each, which our serializer tests compare against\n"
        "(canonicalized, with a documented divergence allowlist).\n\n"
        "Regenerate deliberately with:\n\n"
        "    uv run --with openpyxl --with pyxform scripts/make-goldens.py\n\n"
        "and review the diff before committing.\n",
        encoding="utf-8",
    )
    print(f"pyxform {pyxform_version}")


if __name__ == "__main__":
    main()
