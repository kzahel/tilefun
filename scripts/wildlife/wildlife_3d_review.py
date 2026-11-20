"""Read the explicit verdict and feedback from a completed art review."""

import re


VERDICT = re.compile(r"(?<!\w)\*{0,2}VERDICT:\s*(meets-bar|revise|insufficient-evidence)\b\*{0,2}", re.I)


def completed_feedback(review):
    if not review.get("verifiedRoute"):
        return None, ""
    for message in reversed(review.get("conversation", {}).get("messages", [])):
        if message.get("role") != "agent" or message.get("state") != "complete":
            continue
        prose = "\n".join(part["text"] for part in message.get("content", [])
                          if part.get("kind") == "text")
        verdict = VERDICT.search(prose)
        if verdict:
            return verdict.group(1).lower(), prose[verdict.end():].strip()
    return None, ""
