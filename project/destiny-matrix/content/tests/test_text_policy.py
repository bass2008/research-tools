from content.text_policy import POLICY_CASES, is_blocked


def test_canonical_policy_examples_define_python_adapter_contract():
    for case in POLICY_CASES:
        assert is_blocked(case["text"], "content") is case["content_blocked"], case["text"]
        assert is_blocked(case["text"], "html") is case["html_blocked"], case["text"]
