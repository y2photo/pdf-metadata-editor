from fastapi import FastAPI, File, UploadFile, Request, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from pypdf import PdfReader, PdfWriter
from typing import List
import zipfile
import io
import os
from datetime import datetime
import re

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
            .instraction p.note { font-size: 12px; color: #666; margin-top: 10px; }
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
                <p class="note">※1ファイルのサイズ上限は100MB、最大20ファイルまでアップロード可能です。</p>
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
                if (fileInput.files.length > 20) {
                    alert('最大20ファイルまでアップロード可能です。');
                    fileInput.value = '';
                    return;
                }
                for (let file of fileInput.files) {
                    if (file.size > 100 * 1024 * 1024) {
                        alert('1ファイルのサイズ上限は100MBです。');
                        fileInput.value = '';
                        return;
                    }
                }
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
    
    # ファイル数制限
    if len(files) > 20:
        return HTMLResponse("エラー: 最大20ファイルまでアップロード可能です。", status_code=400)
    
    # ファイルサイズ制限
    for file in files:
        if file.size > 100 * 1024 * 1024:  # 100MB
            return HTMLResponse("エラー: 1ファイルのサイズ上限は100MBです。", status_code=400)
    
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
    
    # 連番でソート
    file_list.sort(key=lambda x: x["filename"])
    
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
        input[type="radio"] { margin-right: 5px; }
        .download-button { background-color: #003894; border-radius: 3px; color: #fff; padding: 10px 20px; border: none; cursor: pointer; display: block; margin: 20px auto; }
        .download-button:hover { background-color: #002566; }
        .common-field { margin: 10px 0; }
        .prefix, .suffix, .middle { display: none; }
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
                    <div>
                        <label><input type="radio" name="stem_edit" value="no" checked> タイトルを個別に編集</label>
                        <label><input type="radio" name="stem_edit" value="yes"> ファイル名の幹部分を編集</label>
                    </div>
                    <div class="common-field">
                        <label>共通語句の追加:</label>
                        <label><input type="radio" name="common_pos" value="none" checked> なし</label>
                        <label><input type="radio" name="common_pos" value="prefix"> 先頭</label>
                        <label><input type="radio" name="common_pos" value="middle"> 中央</label>
                        <label><input type="radio" name="common_pos" value="suffix"> 末尾</label>
                        <div class="prefix common-field">
                            <label>先頭語句: <input type="text" name="prefix_text"></label>
                        </div>
                        <div class="middle common-field">
                            <label>中央前: <input type="text" name="middle_prefix"></label>
                            <label>中央後: <input type="text" name="middle_suffix"></label>
                        </div>
                        <div class="suffix common-field">
                            <label>末尾語句: <input type="text" name="suffix_text"></label>
                        </div>
                    </div>
                    <table>
                        <tr>
                            <th>ファイル名</th>
                            <th>タイトル</th>
                        </tr>
    """
    for i, file in enumerate(file_list):
        filename = file["filename"]
        title = file["title"]
        # 連番を抽出
        match = re.match(r"^(.*?)(?:_)?(\d+)\.pdf$", filename)
        stem = filename
        number = ""
        if match:
            stem = match.group(1)
            number = match.group(2)
        html_body += f"""
                        <tr class="file-row" data-stem="{stem}" data-number="{number}">
                            <td>{filename}</td>
                            <td>
                                <span class="stem">{stem}</span>
                                <span class="number">{number}</span>
                                <input type="text" name="title_{i}" value="{title}" class="title-input">
                            </td>
                            <input type="hidden" name="filename_{i}" value="{filename}">
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
        <script>
            const stemEditRadios = document.querySelectorAll('input[name="stem_edit"]');
            const commonPosRadios = document.querySelectorAll('input[name="common_pos"]');
            const prefixDiv = document.querySelector('.prefix');
            const middleDiv = document.querySelector('.middle');
            const suffixDiv = document.querySelector('.suffix');
            const rows = document.querySelectorAll('.file-row');

            stemEditRadios.forEach(radio => {
                radio.addEventListener('change', () => {
                    const useStem = radio.value === 'yes';
                    rows.forEach(row => {
                        const stemSpan = row.querySelector('.stem');
                        const numberSpan = row.querySelector('.number');
                        const titleInput = row.querySelector('.title-input');
                        if (useStem) {
                            stemSpan.style.display = 'inline';
                            numberSpan.style.display = 'inline';
                            titleInput.style.display = 'none';
                            titleInput.value = stemSpan.textContent;
                        } else {
                            stemSpan.style.display = 'none';
                            numberSpan.style.display = 'none';
                            titleInput.style.display = 'inline';
                        }
                    });
                });
            });

            commonPosRadios.forEach(radio => {
                radio.addEventListener('change', () => {
                    prefixDiv.style.display = radio.value === 'prefix' ? 'block' : 'none';
                    middleDiv.style.display = radio.value === 'middle' ? 'block' : 'none';
                    suffixDiv.style.display = radio.value === 'suffix' ? 'block' : 'none';
                });
            });
        </script>
    </body>
    </html>
    """
    return html_body

@app.post("/download", response_class=HTMLResponse)
async def download(request: Request):
    global TEMP_FILES
    form_data = await request.form()
    print("Received form data:", dict(form_data))
    file_count = int(form_data.get("file_count", 0))
    filenames = [form_data.get(f"filename_{i}") for i in range(file_count)]
    titles = [form_data.get(f"title_{i}") for i in range(file_count)]
    
    stem_edit = form_data.get("stem_edit", "no")
    common_pos = form_data.get("common_pos", "none")
    prefix_text = form_data.get("prefix_text", "")
    middle_prefix = form_data.get("middle_prefix", "")
    middle_suffix = form_data.get("middle_suffix", "")
    suffix_text = form_data.get("suffix_text", "")
    
    processed_titles = []
    for i, (filename, title) in enumerate(zip(filenames, titles)):
        if stem_edit == "yes":
            match = re.match(r"^(.*?)(?:_)?(\d+)\.pdf$", filename)
            if match:
                title = match.group(1)
        final_title = title
        if common_pos == "prefix" and prefix_text:
            final_title = prefix_text + final_title
        elif common_pos == "middle" and middle_prefix and middle_suffix:
            final_title = middle_prefix + final_title + middle_suffix
        elif common_pos == "suffix" and suffix_text:
            final_title += suffix_text
        processed_titles.append(final_title)
    
    if not all(filenames) or not all(processed_titles):
        print("Error: Missing filenames or titles")
        return HTMLResponse("エラー: ファイル名またはタイトルが欠けています", status_code=400)
    
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for filename, title in zip(filenames, processed_titles):
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
    
    return HTMLResponse(content=f"""
    <html>
    <body>
        <a id="download-link" href="/static/{zip_filename}" download="{zip_filename}" style="display:none;"></a>
        <script>
            document.getElementById('download-link').click();
            setTimeout(() => window.location.href = '/', 500);
        </script>
    </body>
    </html>
    """)

@app.get("/static/{filename}", response_class=FileResponse)
async def get_static_file(filename: str):
    return FileResponse(filename, filename=filename)