from fastapi import FastAPI, File, UploadFile, Request, HTTPException
from fastapi.responses import HTMLResponse, FileResponse, RedirectResponse
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
    return HTMLResponse(content="""
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
        <meta http-equiv="Pragma" content="no-cache">
        <meta http-equiv="Expires" content="0">
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
            .tabs { display: flex; margin-bottom: 20px; }
            .tab { padding: 10px 20px; cursor: pointer; background: #ddd; margin-right: 5px; border-radius: 3px 3px 0 0; }
            .tab.active { background: #fff; border-bottom: none; }
            .tab-content { display: none; }
            .tab-content.active { display: block; }
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
                <p class="note">※1ファイルのサイズ上限は10MB、最大20ファイルまでアップロード可能です。</p>
            </section>
            <section>
                <div class="tabs">
                    <div class="tab active" data-tab="normal">通常アップロード</div>
                    <div class="tab" data-tab="sequential">連番ファイル</div>
                    <div class="tab" data-tab="common">共通語句</div>
                </div>
                <div class="tab-content active" id="normal">
                    <div class="js-fileUpload" data-form="normal_form">
                        <div class="text">ここにファイルをドラッグ＆ドロップ<br>または</div>
                        <form id="normal_form" method="post" action="/" enctype="multipart/form-data">
                            <input type="file" id="normal_files" name="files" class="file-input" multiple accept=".pdf">
                            <button type="button" class="upload-button" onclick="document.getElementById('normal_files').click();">ファイル選択</button>
                        </form>
                        <div class="file-name is-hidden"></div>
                        <div class="cancel-button is-hidden">キャンセル</div>
                    </div>
                </div>
                <div class="tab-content" id="sequential">
                    <div class="js-fileUpload" data-form="sequential_form">
                        <div class="text">連番ファイル（例：report_001.pdf）をドラッグ＆ドロップ<br>または</div>
                        <form id="sequential_form" method="post" action="/" enctype="multipart/form-data">
                            <input type="file" id="sequential_files" name="files" class="file-input" multiple accept=".pdf">
                            <button type="button" class="upload-button" onclick="document.getElementById('sequential_files').click();">ファイル選択</button>
                        </form>
                        <div class="file-name is-hidden"></div>
                        <div class="cancel-button is-hidden">キャンセル</div>
                    </div>
                </div>
                <div class="tab-content" id="common">
                    <div class="js-fileUpload" data-form="common_form">
                        <div class="text">共通語句を追加するファイルをドラッグ＆ドロップ<br>または</div>
                        <form id="common_form" method="post" action="/" enctype="multipart/form-data">
                            <input type="file" id="common_files" name="files" class="file-input" multiple accept=".pdf">
                            <button type="button" class="upload-button" onclick="document.getElementById('common_files').click();">ファイル選択</button>
                        </form>
                        <div class="file-name is-hidden"></div>
                        <div class="cancel-button is-hidden">キャンセル</div>
                    </div>
                </div>
            </section>
        </main>
        <footer>
            <div>powered by <a href="https://fastapi.tiangolo.com/" target="_blank">FastAPI</a></div>
        </footer>
        <script>
            const tabs = document.querySelectorAll('.tab');
            const tabContents = document.querySelectorAll('.tab-content');
            const dropZones = document.querySelectorAll('.js-fileUpload');

            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    tabContents.forEach(c => c.classList.remove('active'));
                    tab.classList.add('active');
                    document.getElementById(tab.dataset.tab).classList.add('active');
                });
            });

            dropZones.forEach(zone => {
                const form = document.getElementById(zone.dataset.form);
                const fileInput = form.querySelector('.file-input');
                const fileNameDiv = zone.querySelector('.file-name');
                const cancelButton = zone.querySelector('.cancel-button');

                zone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    zone.style.backgroundColor = '#e0e0e0';
                });

                zone.addEventListener('dragleave', () => {
                    zone.style.backgroundColor = '';
                });

                zone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    zone.style.backgroundColor = '';
                    fileInput.files = e.dataTransfer.files;
                    updateFileNames(fileInput, fileNameDiv, cancelButton);
                    form.submit();
                });

                fileInput.addEventListener('change', () => {
                    updateFileNames(fileInput, fileNameDiv, cancelButton);
                    form.submit();
                });

                cancelButton.addEventListener('click', () => {
                    fileInput.value = '';
                    fileNameDiv.classList.add('is-hidden');
                    cancelButton.classList.add('is-hidden');
                    fileNameDiv.textContent = '';
                });

                function updateFileNames(input, nameDiv, cancelBtn) {
                    if (input.files.length > 20) {
                        alert('最大20ファイルまでアップロード可能です。');
                        input.value = '';
                        return;
                    }
                    for (let file of input.files) {
                        if (file.size > 10 * 1024 * 1024) {
                            alert('1ファイルのサイズ上限は10MBです。');
                            input.value = '';
                            return;
                        }
                    }
                    if (input.files.length > 0) {
                        nameDiv.classList.remove('is-hidden');
                        cancelBtn.classList.remove('is-hidden');
                        let names = Array.from(input.files).map(f => f.name).join(', ');
                        nameDiv.textContent = `選択されたファイル: ${names}`;
                    }
                }
            });
        </script>
    </body>
    </html>
    """, media_type="text/html")  # type: ignore

@app.post("/", response_class=HTMLResponse)
async def upload(request: Request, files: List[UploadFile] = File(...)):
    global TEMP_FILES
    TEMP_FILES.clear()
    
    # ファイル数制限
    if len(files) > 20:
        return HTMLResponse("エラー: 最大20ファイルまでアップロード可能です。", status_code=400, media_type="text/html")
    
    # ファイルサイズ制限
    for file in files:
        if file.size > 10 * 1024 * 1024:  # 10MB
            return HTMLResponse("エラー: 1ファイルのサイズ上限は10MBです。", status_code=400, media_type="text/html")
    
    file_list = []
    form_data = await request.form()
    upload_type = "normal"
    print("Form data:", dict(form_data))  # デバッグ用
    if "normal_files" in form_data:
        upload_type = "normal"
    elif "sequential_files" in form_data:
        upload_type = "sequential"
    elif "common_files" in form_data:
        upload_type = "common"
    
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
    
    # 連番ソート（sequential のみ）
    if upload_type == "sequential":
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
        .common-field, .stem-field { margin: 10px 0; }
        .prefix, .suffix, .middle { display: none; }
        .stem-prefix, .stem-suffix { display: none; }
        .number { margin-left: 5px; color: #666; }
        footer { max-width: 940px; text-align: center; font-size: 14px; margin: 20px auto; }
    </style>
    """  # type: ignore
    html_body = f"""
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
        <meta http-equiv="Pragma" content="no-cache">
        <meta http-equiv="Expires" content="0">
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
                    <input type="hidden" name="upload_type" value="{upload_type}">
    """
    if upload_type == "normal":
        html_body += """
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
    elif upload_type == "sequential":
        html_body += """
                    <div class="stem-field">
                        <label>連番の位置:</label>
                        <label><input type="radio" name="stem_pos" value="prefix" checked> 連番の前</label>
                        <label><input type="radio" name="stem_pos" value="suffix"> 連番の後</label>
                        <div class="stem-prefix">
                            <label>ファイル名の幹部分（連番の前）: <input type="text" name="stem_prefix_text"></label>
                        </div>
                        <div class="stem-suffix is-hidden">
                            <label>ファイル名の幹部分（連番の後）: <input type="text" name="stem_suffix_text"></label>
                        </div>
                    </div>
                    <table>
                        <tr>
                            <th>ファイル名</th>
                            <th>連番</th>
                            <th>タイトル</th>
                        </tr>
        """
        for i, file in enumerate(file_list):
            filename = file["filename"]
            match = re.match(r"^(.*?)(?:_)?(\d+)\.pdf$", filename)
            stem = filename
            number = ""
            if match:
                stem = match.group(1)
                number = match.group(2)
            html_body += f"""
                        <tr>
                            <td>{filename}</td>
                            <td>{number}</td>
                            <td>
                                <input type="text" name="title_{i}" value="{stem}">
                                <span class="number">{number}</span>
                            </td>
                            <input type="hidden" name="filename_{i}" value="{file['filename']}">
                            <input type="hidden" name="number_{i}" value="{number}">
                        </tr>
            """
    elif upload_type == "common":
        html_body += """
                    <div class="common-field">
                        <label>共通語句の追加:</label>
                        <label><input type="radio" name="common_pos" value="prefix" checked> 先頭</label>
                        <label><input type="radio" name="common_pos" value="middle"> 中央</label>
                        <label><input type="radio" name="common_pos" value="suffix"> 末尾</label>
                        <div class="prefix common-field">
                            <label>先頭語句: <input type="text" name="prefix_text"></label>
                        </div>
                        <div class="middle common-field is-hidden">
                            <label>中央前: <input type="text" name="middle_prefix"></label>
                            <label>中央後: <input type="text" name="middle_suffix"></label>
                        </div>
                        <div class="suffix common-field is-hidden">
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
        <script>
            const stemPosRadios = document.querySelectorAll('input[name="stem_pos"]');
            const stemPrefixDiv = document.querySelector('.stem-prefix');
            const stemSuffixDiv = document.querySelector('.stem-suffix');
            const commonPosRadios = document.querySelectorAll('input[name="common_pos"]');
            const prefixDiv = document.querySelector('.prefix');
            const middleDiv = document.querySelector('.middle');
            const suffixDiv = document.querySelector('.suffix');

            stemPosRadios.forEach(radio => {
                radio.addEventListener('change', () => {
                    stemPrefixDiv.classList.toggle('is-hidden', radio.value !== 'prefix');
                    stemSuffixDiv.classList.toggle('is-hidden', radio.value !== 'suffix');
                });
            });

            commonPosRadios.forEach(radio => {
                radio.addEventListener('change', () => {
                    prefixDiv.classList.toggle('is-hidden', radio.value !== 'prefix');
                    middleDiv.classList.toggle('is-hidden', radio.value !== 'middle');
                    suffixDiv.classList.toggle('is-hidden', radio.value !== 'suffix');
                });
            });

            // 初期表示の設定
            document.querySelector('input[name="stem_pos"][value="prefix"]').dispatchEvent(new Event('change'));
            document.querySelector('input[name="common_pos"][value="prefix"]').dispatchEvent(new Event('change'));
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_body, media_type="text/html")  # type: ignore

@app.post("/download")
async def download(request: Request):
    global TEMP_FILES
    form_data = await request.form()
    file_count = int(form_data.get("file_count", 0))
    filenames = [form_data.get(f"filename_{i}") for i in range(file_count)]
    titles = [form_data.get(f"title_{i}") for i in range(file_count)]
    upload_type = form_data.get("upload_type", "normal")
    
    processed_titles = []
    if upload_type == "normal":
        processed_titles = titles
    elif upload_type == "sequential":
        stem_pos = form_data.get("stem_pos", "prefix")
        stem_prefix_text = form_data.get("stem_prefix_text", "")
        stem_suffix_text = form_data.get("stem_suffix_text", "")
        numbers = [form_data.get(f"number_{i}", "") for i in range(file_count)]
        for number, title in zip(numbers, titles):
            if stem_pos == "prefix":
                processed_titles.append(f"{stem_prefix_text}_{number}" if number else stem_prefix_text)
            else:
                processed_titles.append(f"{number}_{stem_suffix_text}" if number else stem_suffix_text)
    elif upload_type == "common":
        common_pos = form_data.get("common_pos", "prefix")
        prefix_text = form_data.get("prefix_text", "")
        middle_prefix = form_data.get("middle_prefix", "")
        middle_suffix = form_data.get("middle_suffix", "")
        suffix_text = form_data.get("suffix_text", "")
        for title in titles:
            final_title = title
            if common_pos == "prefix" and prefix_text:
                final_title = prefix_text + " " + final_title
            elif common_pos == "middle" and middle_prefix and middle_suffix:
                final_title = middle_prefix + " " + final_title + " " + middle_suffix
            elif common_pos == "suffix" and suffix_text:
                final_title = final_title + " " + suffix_text
            processed_titles.append(final_title)
    
    if not all(filenames) or not all(processed_titles):
        return HTMLResponse("エラー: ファイル名またはタイトルが欠けています", status_code=400, media_type="text/html")
    
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
    
    # ダウンロードリンクを提供し、サーバーサイドでリダイレクト
    return HTMLResponse(content=f"""
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
        <meta http-equiv="Pragma" content="no-cache">
        <meta http-equiv="Expires" content="0">
        <meta http-equiv="refresh" content="3;url=/">
        <title>ダウンロード中...</title>
        <style>
            body { background-color: #efefef; text-align: center; padding: 50px; }
            p { color: #003894; font-size: 18px; }
            a { color: #003894; text-decoration: none; }
            a:hover { color: aquamarine; }
        </style>
    </head>
    <body>
        <p>ファイルをダウンロードしています...</p>
        <p>ダウンロードが始まらない場合は<a href="/static/{zip_filename}" download>こちら</a>をクリックしてください。</p>
        <p>3秒後に自動的にトップページに戻ります。</p>
    </body>
    </html>
    """, media_type="text/html")  # type: ignore

@app.get("/static/{filename}", response_class=FileResponse)
async def get_static_file(filename: str):
    return FileResponse(filename, filename=filename)