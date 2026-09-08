import unittest

from clean_bbc_transcript import clean_transcript


class CleanBbcTranscriptTest(unittest.TestCase):
    def test_removes_variable_width_footer_lines(self) -> None:
        source = """Neil
Body text mentioning bbclearningenglish.com.

 6 Minute English            ©British Broadcasting Corporation 2026
 bbclearningenglish.com                         Page 1 of 5
Georgie
More body text.
6 Minute English        © British Broadcasting Corporation 2025
bbclearningenglish.com             Page 2 of 5
"""

        cleaned, removed_lines = clean_transcript(source)

        self.assertEqual(removed_lines, 4)
        self.assertNotIn("British Broadcasting Corporation", cleaned)
        self.assertNotIn("Page 1 of 5", cleaned)
        self.assertIn("Body text mentioning bbclearningenglish.com.", cleaned)
        self.assertIn("Neil\nBody text", cleaned)
        self.assertIn("Georgie\nMore body text.", cleaned)

    def test_preserves_document_title_and_body_references(self) -> None:
        source = """BBC LEARNING ENGLISH
6 Minute English
How do we describe smells?

Visit bbclearningenglish.com for a quiz.
"""

        cleaned, removed_lines = clean_transcript(source)

        self.assertEqual(removed_lines, 0)
        self.assertIn("6 Minute English", cleaned)
        self.assertIn("Visit bbclearningenglish.com for a quiz.", cleaned)


if __name__ == "__main__":
    unittest.main()
