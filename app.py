import io
import zipfile
import re
from typing import List
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import StreamingResponse, HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import pypdf
import json

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

MAX_SIZE = 10 * 1024 * 1024
MAX_FILES = 20
AUTHOR = "丸善雄松堂株式会社"
JST = timezone(timedelta(hours=9))

field_map = {
    "ALL": "一括ダウンロード",
    "A": "総記",
    "B": "人文科学",
    "C": "社会科学",
    "D": "理工学",
    "F": "語学テキスト",
    "G": "資格試験",
    "H": "新刊",
    "J": "文庫",
    "M": "医学",
    "N": "資格試験:医学",
    "P": "新刊:医学"
}

@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/faq", response_class=HTMLResponse)
async def show_faq(request: Request):
    return templates.TemplateResponse("faq.html", {"request": request})

@app.get("/favicon.ico")
async def favicon():
    return FileResponse("static/favicon.ico")

@app.post("/preview_metadata")
async def preview_metadata(files: List[UploadFile] = File(...)):
    results = []
    for file in files:
        contents = await file.read()
        try:
            reader = pypdf.PdfReader(io.BytesIO(contents))
            title = reader.metadata.get("/Title", "")
        except Exception:
            title = ""
        results.append({"filename": file.filename, "title": title})
    return JSONResponse(content={"titles": results})


@app.post("/upload_normal")
async def upload_normal(
    files: List[UploadFile] = File(...),
    titles: List[str] = Form(...)
):
    if len(files) > MAX_FILES:
        raise HTTPException(400, detail=f"最大{MAX_FILES}ファイルまで")
    for file in files:
        if file.size > MAX_SIZE:
            raise HTTPException(400, detail=f"{file.filename}は10MBを超えています")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for file, title in zip(files, titles):
            contents = await file.read()
            reader = pypdf.PdfReader(io.BytesIO(contents))
            writer = pypdf.PdfWriter()
            for page in reader.pages:
                writer.add_page(page)
            writer.add_metadata({"/Title": title, "/Author": AUTHOR})
            output_buffer = io.BytesIO()
            writer.write(output_buffer)
            zip_file.writestr(file.filename, output_buffer.getvalue())

    zip_buffer.seek(0)
    timestamp = datetime.now(JST).strftime("%Y%m%d_%H%M")
    filename = f"modified_pdfs_{timestamp}.zip"
    print(f"Download filename: {filename}")

    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)

@app.post("/upload_sequential")
async def upload_sequential(
    files: List[UploadFile] = File(...),
    prefix: str = Form(""),
    suffix: str = Form(""),
    titles: List[str] = Form(...),
    numbers: List[str] = Form(...)
):
    if len(files) > MAX_FILES:
        raise HTTPException(400, detail=f"最大{MAX_FILES}ファイルまで")
    for file in files:
        if file.size > MAX_SIZE:
            raise HTTPException(400, detail=f"{file.filename}は10MBを超えています")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for file, title, number in zip(files, titles, numbers):
            contents = await file.read()
            reader = pypdf.PdfReader(io.BytesIO(contents))
            writer = pypdf.PdfWriter()
            for page in reader.pages:
                writer.add_page(page)
            full_title = ""
            if prefix:
                full_title = f"{prefix} {number} {title}"
            elif suffix:
                full_title = f"{prefix} {title} {number}"
            else:
                full_title = f"{number} {title}"

            writer.add_metadata({"/Title": full_title.strip(), "/Author": AUTHOR})
            output_buffer = io.BytesIO()
            writer.write(output_buffer)
            zip_file.writestr(file.filename, output_buffer.getvalue())

    zip_buffer.seek(0)
    timestamp = datetime.now(JST).strftime("%Y%m%d_%H%M")
    filename = f"modified_pdfs_{timestamp}.zip"
    print(f"Download filename: {filename}")

    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)

@app.post("/upload_common")
async def upload_common(
    files: List[UploadFile] = File(...),
    common_phrase: str = Form(""),
    position: str = Form("start"),
    titles: List[str] = Form(...),
    filenames: List[str] = Form(...)
):
    if len(files) > MAX_FILES:
        raise HTTPException(400, detail=f"最大{MAX_FILES}ファイルまで")
    for file in files:
        if file.size > MAX_SIZE:
            raise HTTPException(400, detail=f"{file.filename}は10MBを超えています")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for file, title, filename in zip(files, titles, filenames):
            contents = await file.read()
            reader = pypdf.PdfReader(io.BytesIO(contents))
            writer = pypdf.PdfWriter()
            for page in reader.pages:
                writer.add_page(page)

            if position == "middle" and "|||" in title:
                part1, part2 = title.split("|||", 1)
                full_title = f"{part1} {common_phrase} {part2}".strip()
            elif position == "start":
                full_title = f"{common_phrase} {title}".strip()
            elif position == "end":
                full_title = f"{title} {common_phrase}".strip()
            else:
                full_title = title

            writer.add_metadata({"/Title": full_title, "/Author": AUTHOR})
            output_buffer = io.BytesIO()
            writer.write(output_buffer)
            zip_file.writestr(filename, output_buffer.getvalue())

    zip_buffer.seek(0)
    timestamp = datetime.now(JST).strftime("%Y%m%d_%H%M")
    filename = f"modified_pdfs_{timestamp}.zip"
    print(f"Download filename: {filename}")

    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)

@app.post("/upload_newrelease")
async def upload_newrelease(
    files: List[UploadFile] = File(...),
    month: str = Form(...),
    titles: List[str] = Form(...),
    filenames: List[str] = Form(...),
    week: str = Form(...),
    fields: str = Form(...),
):
    if len(files) > MAX_FILES:
        raise HTTPException(400, detail=f"最大{MAX_FILES}ファイルまで")
        
    for file in files:
        if file.size > MAX_SIZE:
            raise HTTPException(400, detail=f"{file.filename}は10MBを超えています")
    
    field_list = json.loads(fields)

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for i, (file, title, filename) in enumerate(zip(files, titles, filenames)):
            contents = await file.read()
            reader = pypdf.PdfReader(io.BytesIO(contents))
            writer = pypdf.PdfWriter()
            for page in reader.pages:
                writer.add_page(page)

        # ✅ ここで週数＋分野を含めたタイトル生成
            week_part = f"第{week}週" if week else ""
            full_title = f"丸善新刊案内{month}月 {week_part} {field_list[i]} {title}".strip()
            # print(full_title)

            writer.add_metadata({
                "/Title": full_title,
                "/Author": AUTHOR
            })

            output_buffer = io.BytesIO()
            writer.write(output_buffer)
            zip_file.writestr(filename, output_buffer.getvalue())

    zip_buffer.seek(0)
    timestamp = datetime.now(JST).strftime("%Y%m%d_%H%M")
    filename = f"modified_pdfs_{timestamp}.zip"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)