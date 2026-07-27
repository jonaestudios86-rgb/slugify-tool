from slugify import slugify


def test_basic_sentence():
    assert slugify("Hello World") == "hello-world"


def test_special_characters():
    assert slugify("Café & Bar!!") == "caf-bar"


def test_extra_whitespace():
    assert slugify("  lots   of   space  ") == "lots-of-space"


def test_empty_string():
    assert slugify("") == ""
