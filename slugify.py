import re


def slugify(text: str) -> str:
    """Convert a string into a URL-friendly slug."""
    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        print(slugify(" ".join(sys.argv[1:])))
    else:
        print("Usage: python slugify.py <text to slugify>")
