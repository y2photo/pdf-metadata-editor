document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const dropAreas = document.querySelectorAll('.drop-area');

    const fileLists = {
        normal: document.getElementById('file-list-normal'),
        sequential: document.getElementById('file-list-sequential'),
        common: document.getElementById('file-list-common'),
        newrelease: document.getElementById('file-list-newrelease')
    };

    const editButtons = {
        normal: document.getElementById('edit-normal'),
        sequential: document.getElementById('edit-sequential'),
        common: document.getElementById('edit-common'),
        newrelease: document.getElementById('edit-newrelease')
    };

    const forms = {
        normal: document.getElementById('form-normal'),
        sequential: document.getElementById('form-sequential'),
        common: document.getElementById('form-common'),
        newrelease: document.getElementById('form-newrelease')
    };
    const formNew = document.getElementById('form-newrelease');


    let files = { normal: [], sequential: [], common: [], newrelease: [] };
    let metadataTitles = { normal: [], sequential: [], common: [], newrelease: [] };
    let week = '';  // ← グローバルで定義
    let fields = []; // ← 分野配列（全ファイル分）

    async function loadMetadataTitles(tabId) {
        const formData = new FormData();
        files[tabId].forEach(file => formData.append('files', file));
        try {
            const response = await fetch('/preview_metadata', {
                method: 'POST',
                body: formData
            });
            if (response.ok) {
                const json = await response.json();
                metadataTitles[tabId] = json.titles;
            }
        } catch (error) {
            console.error('メタデータ取得エラー:', error);
        }
    }

    function extractNumber(name) {
        const cleanedName = name.replace(/\d{6}_/g, '');
        const matches = cleanedName.match(/\d{2}/);
        if (matches) return matches[0];
        const longMatch = cleanedName.match(/\d{3,}/);
        if (longMatch) return longMatch[0].slice(-2);
        return 'N/A';
    }

    function sortFilesByNumber(fileArray) {
        return fileArray.sort((a, b) => {
            const numA = extractNumber(a.name);
            const numB = extractNumber(b.name);
            if (numA === 'N/A' && numB === 'N/A') return 0;
            if (numA === 'N/A') return 1;
            if (numB === 'N/A') return -1;
            return parseInt(numA, 10) - parseInt(numB, 10);
        });
    }

    function showTemporaryMessage(tabId, message) {
        const fileList = document.getElementById(`file-list-${tabId}`);
        if (!fileList) return;
        fileList.innerHTML = '';
        const msgDiv = document.createElement('div');
        msgDiv.textContent = message;
        msgDiv.classList.add('download-complete-message');
        fileList.appendChild(msgDiv);
    }

    function getTimestamp() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const h = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        return `${y}${m}${d}_${h}${min}`;
    }    

    function updateEditButtonState(tabId) {
        editButtons[tabId].disabled = files[tabId].length === 0;
    }
    // === script.js（完全統合・全タブ対応版 Part 2 / 4）===

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
            if (tab.dataset.tab === 'newrelease') {
                renderNewreleaseList();
            } else {
                renderFileList(tab.dataset.tab);
            }
        });
    });

    const fieldMap = {
        ALL: "一括ダウンロード",
        A: "総記",
        B: "人文科学",
        C: "社会科学",
        D: "理工学",
        F: "語学テキスト",
        G: "資格試験",
        H: "新刊",
        J: "文庫",
        M: "医学",
        N: "資格試験:医学",
        P: "新刊:医学"
    };

    function extractWeekChar(filename) {
        const match = filename.match(/(\d{2})-[A-Z]/);
        if (match) {
            const weekNum = parseInt(match[1].slice(-1), 10);
            return weekNum === 0 ? '' : weekNum;
        }
        return '';
    }

    function extractAlpha(filename) {
        const match = filename.match(/(?:\d{2}-)?(ALL|[A-Z]{1,3})(?=\.|-)/);
        return match ? match[1] : '';
    }

    function getMetadataTitleForFile(tabId, filename) {
        const list = Array.isArray(metadataTitles[tabId]) ? metadataTitles[tabId] : [];
        const meta = list.find(item => item.filename === filename);
        return meta?.title || filename.replace(/\.pdf$/, '');
    }

    function renderFileList(tabId) {
        fileLists[tabId].innerHTML = '';
        const dropArea = document.getElementById(`drop-area-${tabId}`);
        const editButton = editButtons[tabId];

        if (files[tabId].length === 0) {
            dropArea.classList.remove('is-hidden');
            editButton.classList.add('is-hidden');
            return;
        }
        dropArea.classList.add('is-hidden');
        editButton.classList.remove('is-hidden');

        if (tabId === 'sequential') {
            const prefixSuffix = document.createElement('div');
            prefixSuffix.classList.add('prefix-suffix');
            prefixSuffix.innerHTML = `
            <div class="input-group">
                <label for="prefix">幹部分：</label>
                <input type="text" id="prefix" name="prefix">
            </div>
            <div class="input-group">
                <label>タイトルの位置：</label>
                <div class="radio-group">
                    <input type="radio" id="position-prefix" name="position-sequential" value="prefix" checked>
                    <label for="position-prefix">タイトルの前</label>
                    <input type="radio" id="position-suffix" name="position-sequential" value="suffix">
                    <label for="position-suffix">タイトルの後</label>
                </div>
            </div>
        `;
            fileLists[tabId].appendChild(prefixSuffix);
        } else if (tabId === 'common') {
            const commonControls = document.createElement('div');
            commonControls.classList.add('common-controls');
            commonControls.innerHTML = `
            <div class="input-group">
                <label for="common-phrase">共通語句：</label>
                <input type="text" id="common-phrase" name="common-phrase">
            </div>
            <div class="input-group radio-group">
                <label>位置：</label>
                <input type="radio" id="position-start" name="position" value="start" checked>
                <label for="position-start">先頭</label>
                <input type="radio" id="position-middle" name="position" value="middle">
                <label for="position-middle">中央</label>
                <input type="radio" id="position-end" name="position" value="end">
                <label for="position-end">末尾</label>
            </div>
        `;
            fileLists[tabId].appendChild(commonControls);
        }

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const trHead = document.createElement('tr');
        const headers = tabId === 'sequential' ?
            ['ファイル名', 'タイトル', '番号'] :
            ['ファイル名', tabId === 'common' ? '可変部分' : 'タイトル'];
        headers.forEach((text, index) => {
            const th = document.createElement('th');
            th.textContent = text;
            th.classList.add(index === 0 ? 'filename' : index === 1 ? 'title' : 'number');
            trHead.appendChild(th);
        });
        thead.appendChild(trHead);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');

        const sortedFiles = tabId === 'sequential' ? sortFilesByNumber([...files[tabId]]) : files[tabId];
        sortedFiles.forEach((file, index) => {
            const tr = document.createElement('tr');
            const tdName = document.createElement('td');
            tdName.textContent = file.name;
            tr.appendChild(tdName);

            const tdTitle = document.createElement('td');
            const inputWrapper = document.createElement('div');
            inputWrapper.classList.add('input-wrapper');
            const input = document.createElement('input');
            input.type = 'text';
            input.name = `titles[${index}]`;
            input.value = getMetadataTitleForFile(tabId, file.name);
            inputWrapper.appendChild(input);

            if (tabId === 'sequential') {
                const numberInput = document.createElement('input');
                numberInput.type = 'text';
                numberInput.name = `numbers[${index}]`;
                numberInput.classList.add('number');
                numberInput.value = extractNumber(file.name);
                inputWrapper.appendChild(numberInput);
            }

            if (tabId === 'common') {
                const hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.name = `filenames[${index}]`;
                hiddenInput.value = file.name;
                inputWrapper.appendChild(hiddenInput);
            }

            tdTitle.appendChild(inputWrapper);
            tr.appendChild(tdTitle);

            if (tabId === 'sequential') {
                const tdNumber = document.createElement('td');
                tdNumber.classList.add('number');
                tdNumber.textContent = extractNumber(file.name);
                tr.appendChild(tdNumber);
            }
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        fileLists[tabId].appendChild(table);
    }

    function renderNewreleaseList() {
        const fileListNew = document.getElementById('file-list-newrelease');
        const dropAreaNew = document.getElementById('drop-area-newrelease');
        const editButtonNew = document.getElementById('edit-newrelease');

        fileListNew.innerHTML = '';
        if (files.newrelease.length === 0) {
            dropAreaNew.classList.remove('is-hidden');
            editButtonNew.classList.add('is-hidden');
            return;
        }
        dropAreaNew.classList.add('is-hidden');
        editButtonNew.classList.remove('is-hidden');

        const sortedFiles = [...files.newrelease].sort((a, b) => a.name.localeCompare(b.name));
        week = extractWeekChar(sortedFiles[0].name);

        const controlBlock = document.createElement('div');
        controlBlock.classList.add('input-group');
        controlBlock.innerHTML = `
        <label for="release-month">月数：</label>
        <input type="number" id="release-month" name="release-month" min="1" max="12" value="${new Date().getMonth() + 1}" required>
        <span style="margin-left: 1rem;">週数：${week || '不明'}</span>
    `;
        fileListNew.appendChild(controlBlock);

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        thead.innerHTML = `
        <tr>
            <th>ファイル名</th>
            <th>分野</th>
        </tr>
    `;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        fields = [];

        sortedFiles.forEach((file, index) => {
            const alpha = extractAlpha(file.name);
            const field = fieldMap[alpha] || '';
            fields.push(field);

            const tr = document.createElement('tr');
            const tdName = document.createElement('td');
            tdName.textContent = file.name;

            const tdField = document.createElement('td');
            tdField.textContent = field;

            const hiddenFilename = document.createElement('input');
            hiddenFilename.type = 'hidden';
            hiddenFilename.name = `filenames[${index}]`;
            hiddenFilename.value = file.name;

            const hiddenTitle = document.createElement('input');
            hiddenTitle.type = 'hidden';
            hiddenTitle.name = `titles[${index}]`;
            hiddenTitle.value = '';  // タイトル編集なし

            tdName.appendChild(hiddenFilename);
            tdName.appendChild(hiddenTitle);

            tr.appendChild(tdName);
            tr.appendChild(tdField);
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        fileListNew.appendChild(table);
    }


    // === script.js（完全統合・全タブ対応版 Part 4 / 4）===

    dropAreas.forEach(dropArea => {
        const tabId = dropArea.id.split('-')[2];
        const fileInput = document.getElementById(`files-${tabId}`);
        const selectButton = dropArea.querySelector('.select-button');

        selectButton.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', async () => {
            const selectedFiles = Array.from(fileInput.files).filter(f => f.type === 'application/pdf');
            if (files[tabId].length + selectedFiles.length > 20) {
                alert('最大20ファイルまでです');
                return;
            }
            files[tabId].push(...selectedFiles);
            await loadMetadataTitles(tabId);
            tabId === 'newrelease' ? renderNewreleaseList() : renderFileList(tabId);
            updateEditButtonState(tabId);
            fileInput.value = '';
        });

        dropArea.addEventListener('dragover', e => {
            e.preventDefault();
            dropArea.classList.add('dragover');
        });
        dropArea.addEventListener('dragleave', () => {
            dropArea.classList.remove('dragover');
        });
        dropArea.addEventListener('drop', async e => {
            e.preventDefault();
            dropArea.classList.remove('dragover');
            dropArea.classList.add('uploading');
            const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
            if (files[tabId].length + droppedFiles.length > 20) {
                alert('最大20ファイルまでです');
                dropArea.classList.remove('uploading');
                return;
            }
            files[tabId].push(...droppedFiles);
            await loadMetadataTitles(tabId);
            tabId === 'newrelease' ? renderNewreleaseList() : renderFileList(tabId);
            updateEditButtonState(tabId);
            setTimeout(() => dropArea.classList.remove('uploading'), 500);
        });
    });


    // === 通常タブ　===

    forms.normal.addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData();
        files.normal.forEach(file => formData.append('files', file));
        files.normal.forEach((_, index) => {
            const title = document.querySelector(`#file-list-normal input[name="titles[${index}]"]`).value;
            formData.append('titles', title);
        });
        const response = await fetch('/upload_normal', { method: 'POST', body: formData });
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'modified_pdfs_' + getTimestamp() + '.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        
            // 👇 完了メッセージ → 2秒後に normal タブに戻す
            showTemporaryMessage(tabId, 'ダウンロードが完了しました');
        
            function resetToNormalTab() {
                // タブ切り替え
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
            
                // 通常タブをアクティブ化
                const normalTab = document.querySelector('.tab[data-tab="normal"]');
                const normalContent = document.getElementById('normal');
                normalTab.classList.add('active');
                normalContent.classList.add('active');
            
                // ファイルリストとボタンをリセット
                renderFileList('normal');
                updateEditButtonState('normal');
            }
            setTimeout(() => {
                try {
                    if (files[tabId]) files[tabId] = [];
                    if (metadataTitles[tabId]) metadataTitles[tabId] = [];
        
                    // ✅ タブ切り替え
                    tabs.forEach(t => t.classList.remove('active'));
                    tabContents.forEach(c => c.classList.remove('active'));
                    document.querySelector('.tab[data-tab="normal"]').classList.add('active');
                    document.getElementById('normal').classList.add('active');
        
                    // ✅ 通常タブの初期化
                    renderFileList('normal');
                    updateEditButtonState('normal');
                } catch (err) {
                    console.error('reset error:', err);
                }
            }, 2000);
        } else {
            alert('アップロードに失敗しました。');
        }       
    });

    // === 連番タブ　===

    forms.sequential.addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData();
        const sortedFiles = sortFilesByNumber([...files.sequential]);
        sortedFiles.forEach(file => formData.append('files', file));
        sortedFiles.forEach((_, index) => {
            const title = document.querySelector(`#file-list-sequential input[name="titles[${index}]"]`).value;
            const number = document.querySelector(`#file-list-sequential input[name="numbers[${index}]"]`).value;
            formData.append('titles', title);
            formData.append('numbers', number);
        });
        const position = document.querySelector('input[name="position-sequential"]:checked').value;
        const prefix = document.getElementById('prefix').value;
        formData.append('prefix', prefix);
        formData.append('position', position);
        const response = await fetch('/upload_sequential', { method: 'POST', body: formData });
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'modified_pdfs_' + getTimestamp() + '.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        
            // 👇 完了メッセージ → 2秒後に normal タブに戻す
            showTemporaryMessage(tabId, 'ダウンロードが完了しました');
        
            function resetToNormalTab() {
                // タブ切り替え
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
            
                // 通常タブをアクティブ化
                const normalTab = document.querySelector('.tab[data-tab="normal"]');
                const normalContent = document.getElementById('normal');
                normalTab.classList.add('active');
                normalContent.classList.add('active');
            
                // ファイルリストとボタンをリセット
                renderFileList('normal');
                updateEditButtonState('normal');
            }

            setTimeout(() => {
                try {
                    if (files[tabId]) files[tabId] = [];
                    if (metadataTitles[tabId]) metadataTitles[tabId] = [];
        
                    // ✅ タブ切り替え
                    tabs.forEach(t => t.classList.remove('active'));
                    tabContents.forEach(c => c.classList.remove('active'));
                    document.querySelector('.tab[data-tab="normal"]').classList.add('active');
                    document.getElementById('normal').classList.add('active');
        
                    // ✅ 通常タブの初期化
                    renderFileList('normal');
                    updateEditButtonState('normal');
                } catch (err) {
                    console.error('reset error:', err);
                }
            }, 2000);
        } else {
            alert('アップロードに失敗しました。');
        }
    });


    // === 共通語句タブ　===

    forms.common.addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData();
        files.common.forEach(file => formData.append('files', file));
        files.common.forEach((_, index) => {
            const title = document.querySelector(`#file-list-common input[name="titles[${index}]"]`).value;
            const filename = document.querySelector(`#file-list-common input[name="filenames[${index}]"]`).value;
            formData.append('titles', title);
            formData.append('filenames', filename);
        });
        const commonPhrase = document.getElementById('common-phrase').value || '';
        const position = document.querySelector('input[name="position"]:checked')?.value || 'start';
        formData.append('common_phrase', commonPhrase);
        formData.append('position', position);
        const response = await fetch('/upload_common', { method: 'POST', body: formData });
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'modified_pdfs_' + getTimestamp() + '.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        
            // 👇 完了メッセージ → 2秒後に normal タブに戻す
            showTemporaryMessage(tabId, 'ダウンロードが完了しました');
        
            function resetToNormalTab() {
                // タブ切り替え
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
            
                // 通常タブをアクティブ化
                const normalTab = document.querySelector('.tab[data-tab="normal"]');
                const normalContent = document.getElementById('normal');
                normalTab.classList.add('active');
                normalContent.classList.add('active');
            
                // ファイルリストとボタンをリセット
                renderFileList('normal');
                updateEditButtonState('normal');
            }

            setTimeout(() => {
                try {
                    if (files[tabId]) files[tabId] = [];
                    if (metadataTitles[tabId]) metadataTitles[tabId] = [];
        
                    // ✅ タブ切り替え
                    tabs.forEach(t => t.classList.remove('active'));
                    tabContents.forEach(c => c.classList.remove('active'));
                    document.querySelector('.tab[data-tab="normal"]').classList.add('active');
                    document.getElementById('normal').classList.add('active');
        
                    // ✅ 通常タブの初期化
                    renderFileList('normal');
                    updateEditButtonState('normal');
                } catch (err) {
                    console.error('reset error:', err);
                }
            }, 2000);
        } else {
            alert('アップロードに失敗しました。');
        }    
    });


    // === 丸善新刊案内タブ　===

    formNew.addEventListener('submit', async e => {
        console.log("Submitting formNew");
        e.preventDefault();
        const formData = new FormData();
        files.newrelease.forEach(file => formData.append('files', file));
        files.newrelease.forEach((_, index) => {
            const title = document.querySelector(`#file-list-newrelease input[name="titles[${index}]"]`)?.value || '';
            const filename = document.querySelector(`#file-list-newrelease input[name="filenames[${index}]"]`)?.value || '';
            formData.append('titles', title);
            formData.append('filenames', filename);
            formData.append('week', week); // ← 追加
            formData.append('fields', JSON.stringify(fields)); // ← 分野配列

        });
        const month = document.getElementById('release-month')?.value || '';
        formData.append('month', month);

        try {
            const response = await fetch('/upload_newrelease', { method: 'POST', body: formData });
            if (!response.ok) {
                const errorText = await response.text();
                alert('アップロードに失敗しました。詳細: ' + errorText);
                return;
            }

            const disposition = response.headers.get("Content-Disposition");
            let filename = "download.zip";
            if (disposition && disposition.includes("filename=")) {
                const match = disposition.match(/filename="(.+?)"/);
                if (match && match[1]) {
                    filename = match[1];
                }
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'modified_pdfs_' + getTimestamp() + '.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            // files.newrelease = [];
            metadataTitles.newrelease = [];
            // renderNewreleaseList();
            // updateEditButtonState('newrelease');
        
            // 👇 完了メッセージ → 2秒後に normal タブに戻す
            showTemporaryMessage(tabId, 'ダウンロードが完了しました');

            function resetToNormalTab() {
                // タブ切り替え
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
        
                // 通常タブをアクティブ化
                const normalTab = document.querySelector('.tab[data-tab="normal"]');
                const normalContent = document.getElementById('normal');
                normalTab.classList.add('active');
                normalContent.classList.add('active');
                
                // ファイルリストとボタンをリセット
                renderFileList('normal');
                updateEditButtonState('normal');
            }

            setTimeout(() => {
                try {
                    if (files[tabId]) files[tabId] = [];
                    if (metadataTitles[tabId]) metadataTitles[tabId] = [];
        
                    // ✅ タブ切り替え
                    tabs.forEach(t => t.classList.remove('active'));
                    tabContents.forEach(c => c.classList.remove('active'));
                    document.querySelector('.tab[data-tab="normal"]').classList.add('active');
                    document.getElementById('normal').classList.add('active');
        
                    // ✅ 通常タブの初期化
                    renderFileList('normal');
                    updateEditButtonState('normal');
                } catch (err) {
                    console.error('reset error:', err);
                }
            }, 2000);
        } catch (error) {
            alert('ネットワークエラーが発生しました。');
        }
    });
});
