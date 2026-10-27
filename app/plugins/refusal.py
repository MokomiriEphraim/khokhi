import re
from typing import Optional, Tuple

CHEAT_PATTERNS = [
    r"just (clean|do|fix) (it|this) for me",
    r"give me the (answer|file|code|formula|solution)",
    r"do my (assignment|homework|project|task)",
    r"can you (read|open|download|check) my (file|excel|dataset|spreadsheet)",
    r"write (the|a) (formula|query|script|code) for me",
    r"solve (this|my) (assignment|problem) directly",
    r"give me the exact (formula|answer)",
    r"tell me the answer",
    r"do the whole thing",
    r"paste the solution",
]

def check_refusal(message: str) -> Optional[Tuple[str, str]]:
    """
    Checks if a message tries to delegate work or request cheating.
    Returns (refusal_message, matched_pattern) if detected, else None.
    """
    clean_msg = message.lower().strip()
    for pattern in CHEAT_PATTERNS:
        if re.search(pattern, clean_msg):
            refusal_text = (
                "I can't do that — I have no file access and no tools to write code or deliverables for you. "
                "That's by design. But I can guide you through the reasoning so you understand and fix it yourself in 3 minutes. "
                "Which specific column or error are you observing right now?"
            )
            return (refusal_text, pattern)
    return None
