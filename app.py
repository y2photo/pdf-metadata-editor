# app.py
from fastapi import FastAPI, File, UploadFile, Request
from fastapi.responses import HTMLResponse, FileResponse
from pypdf import PdfReader, PdfWriter
from typing import List
import zipfile
import io
import os
from datetime import datetime

app = FastAPI()
TEMP_FILES = {}

@app.get("/", response_class=HTMLResponse)
async def root():
    return """
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PDFメタデータ編集アプリ</title>
        <style>
            html { max-width: 1920px; }
            body { background-color: #efefef; }
            section { max-width: 940px; padding: 20px; margin: 0 auto; }
            .instraction h2 { margin-bottom: 60px; }
            .instraction .item { display: flex; justify-content: space-between; }
            .instraction ul { list-style: none; padding: 0; }
            .instraction .item li { width: 30%; background-color: #fff; max-width: 250px; margin-right: 5%; }
            .instraction .item li:last-child { margin-right: 0; }
            .instraction .item li .step { display: block; color: #666; font-size: 24px; font-weight: 100; text-align: center; margin-top: -50px; margin-bottom: 10px; }
            .instraction .item li .no { display: block; color: #666; font-size: 40px; text-align: center; margin-top: -25px; }
            .instraction p.subtitle { text-align: center; color: #003894; font-size: 18px; font-weight: bold; }
            .instraction p.text { font-size: 14px; padding: 20px; }
            a { text-decoration: none; color: #003894; }
            a:hover { color: aquamarine; }
            a:visited { color: #666; }
            h1 { color: #003894; }
            h2 { border-bottom: 1px solid #003894; border-left: 10px solid #003894; padding-left: 20px; padding-bottom: 5px; color: #003894; margin-bottom: 40px; }
            .js-fileUpload { border: 1px dashed #9b9b9b; border-radius: 3px; padding: 42px; text-align: center; }
            .text { margin-bottom: 10px; }
            .file-name { margin-top: 10px; }
            .is-hidden { display: none !important; }
            .file-preview { display: flex; justify-content: center; margin: 20px auto 10px; }
            .file-preview img { max-height: 400px; object-fit: contain; }
            .upload-button { background-color: #003894; border-radius: 3px; color: #fff; padding: 5px 10px; width: 150px; border: none; cursor: pointer; }
            .cancel-button { border: 1px solid #003894; border-radius: 3px; margin: 10px auto 0; padding: 5px 10px; width: 150px; background: none; cursor: pointer; }
            footer { max-width: 940px; text-align: center; font-size: 14px; margin: 20px auto; }
        </style>
    </head>
    <body>
        <header>
            <h1>PDFタイトル編集</h1>
            <nav></nav>
        </header>
        <main>
            <section class="instraction">
                <h2>作業手順</h2>
                <ul class="item">
                    <li>
                        <div class="title">
                            <span class="step">STEP</span>
                            <span class="no">1</span>
                        </div>
                        <p class="subtitle">アップロード</p>
                        <p class="text">タイトルを修正したいPDFを<br>アップロード</p>
                    </li>
                    <li>
                        <div class="title">
                            <span class="step">STEP</span>
                            <span class="no">2</span>
                        </div>
                        <p class="subtitle">タイトル修正</p>
                        <p class="text">各ファイルのタイトルを<br>書き込み、保存</p>
                    </li>
                    <li>
                        <div class="title">
                            <span class="step">STEP</span>
                            <span class="no">3</span>
                        </div>
                        <p class="subtitle">ダウンロード</p>
                        <p class="text">タイトルを修正したPDFを<br>ダウンロード</p>
                    </li>
                </ul>
            </section>
            <section>
                <div class="js-fileUpload">
                    <div class="text">ここにファイルをドラッグ＆ドロップ<br>または</div>
                    <form id="upload_form" method="post" enctype="multipart/form-data">
                        <input type="file" id="files" name="files" class="file-input is-hidden" multiple accept=".pdf">
                        <button type="button" class="upload-button" onclick="document.getElementById('files').click();">ファイル選択</button>
                        <button type="submit" class="upload-button" style="display: none;">アップロード</button>
                    </form>
                    <div class="file-name is-hidden"></div>
                    <div class="cancel-button is-hidden">キャンセル</div>
                </div>
            </section>
        </main>
        <footer>
            <div>powered by <a href="https://fastapi.tiangolo.com/" target="_blank">FastAPI</a></div>
        </footer>
        <script>
            const dropZone = document.querySelector('.js-fileUpload');
            const fileInput = document.getElementById('files');
            const form = document.getElementById('upload_form');
            const fileNameDiv = document.querySelector('.file-name');
            const cancelButton = document.querySelector('.cancel-button');
            const submitButton = form.querySelector('button[type="submit"]');

            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.style.backgroundColor = '#e0e0e0';
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.style.backgroundColor = '';
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.style.backgroundColor = '';
                fileInput.files = e.dataTransfer.files;
                updateFileNames();
                form.submit();
            });

            fileInput.addEventListener('change', () => {
                updateFileNames();
                form.submit();
            });

            function updateFileNames() {
                if (fileInput.files.length > 0) {
                    fileNameDiv.classList.remove('is-hidden');
                    cancelButton.classList.remove('is-hidden');
                    let names = Array.from(fileInput.files).map(f => f.name).join(', ');
                    fileNameDiv.textContent = `選択されたファイル: ${names}`;
                }
            }

            cancelButton.addEventListener('click', () => {
                fileInput.value = '';
                fileNameDiv.classList.add('is-hidden');
                cancelButton.classList.add('is-hidden');
                fileNameDiv.textContent = '';
            });
        </script>
    </body>
    </html>
    """

@app.post("/", response_class=HTMLResponse)
async def upload(files: List[UploadFile] = File(...)):
    global TEMP_FILES
    TEMP_FILES.clear()
    file_list = []
    for file in files:
        filename = file.filename
        contents = await file.read()
        temp_path = f"temp_{filename}"
        with open(temp_path, "wb") as f:
            f.write(contents)
        reader = PdfReader(temp_path)
        title = reader.metadata.get('/Title', filename) if reader.metadata else filename
        file_list.append({"filename": filename, "title": title})
        TEMP_FILES[filename] = temp_path
    
    css = """
    <style>
        html { max-width: 1920px; }
        body { background-color: #efefef; }
        section { max-width: 940px; padding: 20px; margin: 0 auto; }
        h1 { color: #003894; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
        th { background-color: #f2f2f2; color: #003894; }
        input[type="text"] { width: 100%; padding: 5px; box-sizing: border-box; }
        .download-button { background-color: #003894; border-radius: 3px; color: #fff; padding: 10px 20px; border: none; cursor: pointer; display: block; margin: 20px auto; }
        .download-button:hover { background-color: #002566; }
        footer { max-width: 940px; text-align: center; font-size: 14px; margin: 20px auto; }
    </style>
    """
    html_body = f"""
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PDFメタデータ編集アプリ</title>
        {css}
    </head>
    <body>
        <header>
            <h1>PDFタイトル編集</h1>
            <nav></nav>
        </header>
        <main>
            <section>
                <form method="post" action="/download" enctype="multipart/form-data">
                    <input type="hidden" name="file_count" value="{len(file_list)}">
                    <table>
                        <tr>
                            <th>ファイル名</th>
                            <th>タイトル</th>
                        </tr>
    """
    for i, file in enumerate(file_list):
        html_body += f"""
                        <tr>
                            <td>{file['filename']}</td>
                            <td><input type="text" name="title_{i}" value="{file['title']}"></td>
                            <input type="hidden" name="filename_{i}" value="{file['filename']}">
                        </tr>
        """
    html_body += """
                    </table>
                    <button type="submit" class="download-button">ダウンロード</button>
                </form>
            </section>
        </main>
        <footer>
            <div>powered by <a href="https://fastapi.tiangolo.com/" target="_blank">FastAPI</a></div>
        </footer>
    </body>
    </html>
    """
    return html_body

@app.post("/download", response_class=FileResponse)
async def download(request: Request):
    global TEMP_FILES
    form_data = await request.form()
    print("Received form data:", dict(form_data))
    file_count = int(form_data.get("file_count", 0))
    filenames = [form_data.get(f"filename_{i}") for i in range(file_count)]
    titles = [form_data.get(f"title_{i}") for i in range(file_count)]
    
    if not all(filenames) or not all(titles):
        print("Error: Missing filenames or titles")
        return HTMLResponse("エラー: ファイル名またはタイトルが欠けています", status_code=400)
    
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for filename, title in zip(filenames, titles):
            input_path = TEMP_FILES[filename]
            reader = PdfReader(input_path)
            writer = PdfWriter()
            for page in reader.pages:
                writer.add_page(page)
            writer.add_metadata({
                '/Title': title,
                '/Author': '丸善雄松堂株式会社'
            })
            output_path = f"modified_{filename}"
            with open(output_path, "wb") as f:
                writer.write(f)
            zip_file.write(output_path, filename)
            os.remove(output_path)
    
    for temp_path in TEMP_FILES.values():
        os.remove(temp_path)
    TEMP_FILES.clear()
    
    zip_buffer.seek(0)
    timestamp = datetime.now().strftime('%Y%m%d')
    zip_filename = f"modified_pdfs_{timestamp}.zip"
    with open(zip_filename, "wb") as f:
        f.write(zip_buffer.getvalue())
    return FileResponse(zip_filename, filename=zip_filename)