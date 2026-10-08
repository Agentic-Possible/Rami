import contextlib
import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from narrate import book
from narrate.cli import main
from jsonschema import validate


class PipelineTest(unittest.TestCase):
    def make_book(self, root: Path) -> Path:
        path = root / 'fixture.epub'
        with zipfile.ZipFile(path, 'w') as archive:
            archive.writestr('mimetype', 'application/epub+zip')
            archive.writestr(
                'META-INF/container.xml',
                """
                <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
                  <rootfiles><rootfile full-path="book.opf"/></rootfiles>
                </container>""",
            )
            archive.writestr(
                'book.opf',
                """
                <package xmlns="http://www.idpf.org/2007/opf">
                  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
                    <dc:title>Fixture</dc:title><dc:creator>Test</dc:creator>
                  </metadata>
                  <manifest>
                    <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>
                    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
                  </manifest>
                  <spine><itemref idref="chapter"/></spine>
                </package>""",
            )
            archive.writestr(
                'nav.xhtml',
                """
                <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
                  <body><nav epub:type="toc"><a href="chapter.xhtml#chapter">Chapter</a></nav></body>
                </html>""",
            )
            archive.writestr(
                'chapter.xhtml',
                """
                <html xmlns="http://www.w3.org/1999/xhtml"><body>
                  <h1 id="chapter">Chapter</h1><p>A synthetic sentence. Another sentence.</p>
                </body></html>""",
            )
        return path

    def test_dry_run_writes_nothing(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = self.make_book(root)
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(main([str(source), '--dry-run', '-o', str(root / 'output')]), 0)
            self.assertFalse((root / 'output').exists())

    def test_silence_pipeline_and_resume(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = self.make_book(root)
            output = root / 'output'
            args = [str(source), '--backend', 'silence', '--format', 'wav', '-o', str(output)]
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(main(args), 0)
            sync = json.loads((output / 'sync.json').read_text())
            schema_path = Path(__file__).resolve().parents[3] / 'docs/sync.schema.json'
            validate(sync, json.loads(schema_path.read_text()))
            self.assertEqual(sync['book']['title'], 'Fixture')
            self.assertEqual(len(sync['parts']), 1)
            audio = output / sync['parts'][0]['file']
            modified = audio.stat().st_mtime_ns
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(main([*args, '--resume']), 0)
            self.assertEqual(audio.stat().st_mtime_ns, modified)
            derived = book.load(str(output / sync['epub']))
            self.assertIn(b'mg-', derived.files['chapter.xhtml'])

    def test_missing_package_fails_without_network(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'broken.epub'
            with zipfile.ZipFile(path, 'w') as archive:
                archive.writestr('mimetype', 'application/epub+zip')
            with self.assertRaisesRegex(ValueError, 'OPF'):
                book.load(str(path))
