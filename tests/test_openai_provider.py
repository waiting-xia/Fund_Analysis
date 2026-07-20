import json
import unittest
from unittest.mock import patch

from fund_agent.providers import OpenAICompatibleAnalysisProvider


class FakeResponse:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return json.dumps({"choices": [{"message": {"content": "结构化分析结果"}}]}).encode()


class OpenAICompatibleProviderTests(unittest.TestCase):
    @patch("fund_agent.providers.request.urlopen", return_value=FakeResponse())
    def test_uses_openai_chat_completions_protocol(self, mocked_urlopen):
        provider = OpenAICompatibleAnalysisProvider(
            api_key="test-key",
            base_url="https://model.example/v1/",
            model="test-model",
        )
        result = provider.analyze({"factor_signal": {"total_score": 60}})
        self.assertEqual(result, "结构化分析结果")
        request = mocked_urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://model.example/v1/chat/completions")
        payload = json.loads(request.data)
        self.assertEqual(payload["model"], "test-model")
        self.assertEqual(payload["messages"][0]["role"], "system")
        self.assertTrue(request.headers["Authorization"].startswith("Bearer "))


if __name__ == "__main__":
    unittest.main()
