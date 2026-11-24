import json
import os
import tempfile
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch

import recommend as app


class RecommendationTests(unittest.TestCase):
    def test_latest_pdf_by_commit_order(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(app, "ROOM", Path(tmp)):
            def git(*args):
                subprocess.run(["git", "-C", tmp, "-c", "user.email=test@example.org",
                                "-c", "user.name=Test", *args], check=True, capture_output=True)
            git("init")
            for name in ["Z - first.pdf", "A (updated).PDF"]:
                (Path(tmp) / name).write_bytes(b"fixture")
                git("add", "--", name)
                git("commit", "-m", "Upload")
                self.assertEqual(app.active_file().name, name)
            # Git's read-only files on Windows are cleaned by TemporaryDirectory.

    def test_upload_new_match_digest_and_replacement(self):
        previous = Path.cwd()
        with tempfile.TemporaryDirectory() as directory:
            os.chdir(directory)
            try:
                Path("matchroom").mkdir()
                Path("public").mkdir()
                resume = Path("matchroom/resume.txt")
                resume.write_text("Developed Python and SQL reporting tools for software teams.")
                role = dict(id="a", title="Analyst I", location="India", required=["Python and SQL"],
                            preferred=["3 years of SQL experience"], duties=[], jobUrl="https://example.org/a")
                data = dict(initial=[role], newOpenings=[], checkedAt="2026-11-24T16:00:00Z")
                def write():
                    Path("public/jobs.json").write_text(json.dumps(data))
                write()
                with patch.object(app,"active_file",return_value=resume), patch.object(app,"mail") as send, patch.object(app,"model_note",return_value=""):
                    app.run()
                    send.assert_not_called()
                    self.assertIn("Strong",app.RANKINGS.read_text(encoding="utf8"))
                    data["newOpenings"] = [dict(role,id="b"),dict(role,id="c",required=["1 year of SQL experience"]),
                                           dict(role,id="d",location="Indiana, USA", title="Foreign role")]
                    write()
                    app.run()
                    self.assertEqual(send.call_count,2)
                    self.assertNotIn("Foreign role",app.RANKINGS.read_text(encoding="utf8"))
                    self.assertIn("10 months",send.call_args.args[1])
                    app.run()
                    resume.write_text("Developed accessible HTML interfaces and wrote documentation.")
                    app.run()
                    self.assertEqual(send.call_count,2)
                    self.assertNotIn("## Strong",app.RANKINGS.read_text(encoding="utf8"))
            finally:
                os.chdir(previous)
