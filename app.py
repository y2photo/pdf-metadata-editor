# app.py (一部抜粋)
from fastapi import FastAPI, File, UploadFile, Request
from fastapi.responses import HTMLResponse, FileResponse, RedirectResponse
from pypdf import PdfReader, PdfWriter
from typing import List
import zipfile
import io
import os
from datetime import datetime

app = FastAPI()
TEMP_FILES = {}

# @app.get("/") と @app.post("/") は変更なし

@app.post("/download", response_class=HTMLResponse)
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
    
    # HTML でダウンロードとリダイレクト
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