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

    async function fetchMetadataTitles(fileList) {
        const formData = new FormData();
        fileList.forEach(file => formData.append('files', file));
        try {
            const res = await fetch('/preview_metadata', {
                method: 'POST',
                body: formData
            });
            const json = await res.json();
            return json.titles.map(item => item.title || '');
        } catch (error) {
            console.warn('メタデータ取得に失敗しました');
            return fileList.map(_ => '');
        }
    }

    function extractNumber(name) {
        const cleanedName = name.replace(/\d{6}_/g, '');
        // 3桁を優先してマッチ
        const match3 = cleanedName.match(/\d{3}(?!.*\d)/);  // 末尾に最も近い3桁の数字
        if (match3) return match3[0];
        // 次に2桁
        const match2 = cleanedName.match(/\d{2}(?!.*\d)/);
        if (match2) return match2[0];
        // 最後に1桁
        const match1 = cleanedName.match(/\d(?!.*\d)/);
        if (match1) return match1[0];
        
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

    function updateEditButtonState(tabId) {
        editButtons[tabId].disabled = files[tabId].length === 0;
    }
    
    // === タブ切り替え設定===

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

    function getMetadataTitleForFile(tabId, filename) {
        const list = Array.isArray(metadataTitles[tabId]) ? metadataTitles[tabId] : [];
        const meta = list.find(item => item.filename === filename);
        return meta?.title || filename.replace(/\.pdf$/, '');
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


    // === 丸善新刊案内用設定===

    // アルファベットと分野の対応

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

    // 週数取得

    function extractWeekChar(filename) {
        const match = filename.match(/(\d{2})-[A-Z]/);
        if (match) {
            const weekNum = parseInt(match[1].slice(-1), 10);
            return weekNum === 0 ? '' : weekNum;
        }
        return '';
    }

    // All先頭でアルファベット順に

    function extractAlpha(filename) {
        const match = filename.match(/(?:\d{2}-)?(ALL|[A-Z]{1,3})(?=\.|-)/);
        return match ? match[1] : '';
    }

    function getMetadataTitleForFile(tabId, filename) {
        const list = Array.isArray(metadataTitles[tabId]) ? metadataTitles[tabId] : [];
        const meta = list.find(item => item.filename === filename);
        return meta?.title || filename.replace(/\.pdf$/, '');
    }


    // === 通常・連番・共通語句のファイル一覧表示設定===

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
            const existing = fileLists[tabId].querySelector('.prefix-suffix');
            if (existing) fileLists[tabId].removeChild(existing);

            const prefixSuffix = document.createElement('div');
            prefixSuffix.classList.add('prefix-suffix');

            prefixSuffix.innerHTML = `
                <div class="input-group">
                    <label for="prefix">共通部分：</label>
                    <input type="text" id="prefix" name="prefix">
                </div>
                <div class="input-group">
                    <label>連番の位置：</label>
                    <div class="radio-group">
                        <input type="radio" id="position-prefix" name="position-sequential" value="prefix" checked>
                        <label for="position-prefix">タイトルの前</label>
                        <input type="radio" id="position-suffix" name="position-sequential" value="suffix">
                        <label for="position-suffix">タイトルの後</label>
                    </div>
                </div>
            `;

            fileLists[tabId].appendChild(prefixSuffix);

            const prefixField = prefixSuffix.querySelector('.prefix-field');
            const suffixField = prefixSuffix.querySelector('.suffix-field');
            const positionRadios = prefixSuffix.querySelectorAll('input[name="position-sequential"]');
            positionRadios.forEach(radio => {
                radio.addEventListener('change', () => {
                    prefixField.classList.toggle('is-hidden', radio.value !== 'prefix');
                    suffixField.classList.toggle('is-hidden', radio.value !== 'suffix');
                });
            });
        }

        if (tabId === 'common') {
            const existingControls = fileLists[tabId].querySelector('.common-controls');
            if (existingControls) {
                fileLists[tabId].removeChild(existingControls);
            }

            const commonControlsWrapper = document.createElement('div');
            commonControlsWrapper.classList.add('common-controls');

            const phraseGroup = document.createElement('div');
            phraseGroup.classList.add('input-group');
            const phraseLabel = document.createElement('label');
            phraseLabel.setAttribute('for', 'common-phrase');
            phraseLabel.textContent = '共通語句：';
            const phraseInput = document.createElement('input');
            phraseInput.type = 'text';
            phraseInput.id = 'common-phrase';
            phraseInput.name = 'common-phrase';
            phraseGroup.appendChild(phraseLabel);
            phraseGroup.appendChild(phraseInput);

            const radioGroupWrapper = document.createElement('div');
            radioGroupWrapper.classList.add('input-group', 'radio-group');

            const positionLabel = document.createElement('label');
            positionLabel.textContent = '語句の位置：';
            radioGroupWrapper.appendChild(positionLabel);

            const positions = [
                { id: 'position-start', value: 'start', label: '先頭' },
                { id: 'position-middle', value: 'middle', label: '中央' },
                { id: 'position-end', value: 'end', label: '末尾' }
            ];

            positions.forEach(pos => {
                const input = document.createElement('input');
                input.type = 'radio';
                input.id = pos.id;
                input.name = 'position';
                input.value = pos.value;

                // 選択状態の復元：DOMが再生成された後も維持
                if (pos.value === window.currentPosition) {
                    input.checked = true;
                } else if (!window.currentPosition && pos.value === 'start') {
                    input.checked = true;
                    window.currentPosition = 'start';
                }

                const label = document.createElement('label');
                label.setAttribute('for', pos.id);
                label.textContent = pos.label;

                radioGroupWrapper.appendChild(input);
                radioGroupWrapper.appendChild(label);
            });

            commonControlsWrapper.appendChild(phraseGroup);
            commonControlsWrapper.appendChild(radioGroupWrapper);
            fileLists[tabId].appendChild(commonControlsWrapper);

            const positionRadios = radioGroupWrapper.querySelectorAll('input[name="position"]');
            positionRadios.forEach(radio => {
                radio.addEventListener('change', () => {
                    window.currentPosition = radio.value;
                    renderFileList(tabId);
                });
            });
        }

        const sortedFiles = tabId === 'sequential'
            ? sortFilesByNumber([...files[tabId]])
            : files[tabId];

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const trHead = document.createElement('tr');
        const headers = tabId === 'sequential'
            ? ['ファイル名', 'タイトル', '番号']
            : ['ファイル名', 'タイトル'];
        headers.forEach(text => {
            const th = document.createElement('th');
            
            th.textContent = text;

            trHead.appendChild(th);
        });
        thead.appendChild(trHead);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        sortedFiles.forEach((file, index) => {
            const tr = document.createElement('tr');

            const tdName = document.createElement('td');
            tdName.textContent = file.name;
            tr.appendChild(tdName);

            const tdTitle = document.createElement('td');
            const wrapper = document.createElement('div');
            wrapper.classList.add('input-wrapper');

            const metadataTitle = metadataTitles[tabId][index] || '';
            const fallbackTitle = file.name.replace(/\d{6}_/g, '').replace('.pdf', '');

            if (tabId === 'common') {
                const position = document.querySelector('input[name="position"]:checked')?.value || 'start';
                if (position === 'middle') {
                    const input1 = document.createElement('input');
                    input1.type = 'text';
                    input1.name = `title-part1-${index}`;
                    input1.placeholder = 'タイトル前半';
                    input1.value = '';
                    const input2 = document.createElement('input');
                    input2.type = 'text';
                    input2.name = `title-part2-${index}`;
                    input2.placeholder = 'タイトル後半';
                    input2.value = '';
                    wrapper.appendChild(input1);
                    wrapper.appendChild(input2);
                } else {
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.name = `titles[${index}]`;
                    input.value = metadataTitle || fallbackTitle;
                    wrapper.appendChild(input);
                }
                const hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.name = `filenames[${index}]`;
                hiddenInput.value = file.name;
                wrapper.appendChild(hiddenInput);
            } else {
                const input = document.createElement('input');
                input.type = 'text';
                input.name = `titles[${index}]`;
                input.value = metadataTitle || fallbackTitle;
                wrapper.appendChild(input);
            }

            tdTitle.appendChild(wrapper);
            tr.appendChild(tdTitle);

            if (tabId === 'sequential') {
                const tdNumber = document.createElement('td');
                tdNumber.classList.add('number');
                const input = document.createElement('input');
                input.type = 'text';
                input.name = `number[${index}]`;
                input.value = extractNumber(file.name);
                tdNumber.appendChild(input);
                tr.appendChild(tdNumber);
            }

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        fileLists[tabId].appendChild(table);
    }

    // === 丸善新刊案内タブのファイル一覧表示設定 ===
    
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


    // === ドロップエリアの動作設定 ===

    dropAreas.forEach(dropArea => {
        const tabId = dropArea.id.split('-')[2];
        const fileInput = document.getElementById(`files-${tabId}`);
        const selectButton = dropArea.querySelector('.select-button');

        selectButton.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', async () => {
            const selectedFiles = Array.from(fileInput.files).filter(
                f => f.type === 'application/pdf' && f.size <= 10 * 1024 * 1024
            );
            if (files[tabId].length + selectedFiles.length > 20) {
                alert('最大20ファイルまでです');
                return;
            }
            files[tabId].push(...selectedFiles);
            metadataTitles[tabId].push(...await loadMetadataTitles(selectedFiles));
            renderFileList(tabId);
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
            const droppedFiles = Array.from(e.dataTransfer.files).filter(
                f => f.type === 'application/pdf' && f.size <= 10 * 1024 * 1024
            );
            if (files[tabId].length + droppedFiles.length > 20) {
                alert('最大20ファイルまでです');
                dropArea.classList.remove('uploading');
                return;
            }
            files[tabId].push(...droppedFiles);
            metadataTitles[tabId].push(...await fetchMetadataTitles(droppedFiles));
            renderFileList(tabId);
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
    
        try {
            const response = await fetch('/upload_normal', { method: 'POST', body: formData });
            if (response.ok) {
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
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
    
                files.normal = [];
                metadataTitles.normal = [];
                renderFileList('normal');
                updateEditButtonState('normal');
            } else {
                alert('アップロードに失敗しました。');
            }
        } catch (error) {
            alert('ネットワークエラーが発生しました。');
        }
    });

    // === 連番タブ　===

    forms.sequential.addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData();
        const sortedFiles = sortFilesByNumber([...files.sequential]);
    
        sortedFiles.forEach(file => formData.append('files', file));
        sortedFiles.forEach((_, index) => {
            const title = document.querySelector(`#file-list-sequential input[name="titles[${index}]"]`)?.value || '';
            const number = document.querySelector(`#file-list-sequential input[name="number[${index}]"]`)?.value || '';
            formData.append('titles', title);
            formData.append('numbers', number);
        });
    
        const position = document.querySelector('input[name="position-sequential"]:checked')?.value || 'prefix';
        const prefix = position === 'prefix' ? document.getElementById('prefix').value : '';
        const suffix = position === 'suffix' ? document.getElementById('suffix').value : '';
        formData.append('prefix', prefix);
        formData.append('suffix', suffix);
    
        try {
            const response = await fetch('/upload_sequential', { method: 'POST', body: formData });
            if (response.ok) {
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
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
    
                files.sequential = [];
                metadataTitles.sequential = [];
                renderFileList('sequential');
                updateEditButtonState('sequential');
            } else {
                const errorText = await response.text();
                alert('アップロードに失敗しました。詳細: ' + errorText);
            }
        } catch (error) {
            alert('ネットワークエラーが発生しました。');
        }
    });


    // === 共通語句タブ　===

    forms.common.addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData();
        const position = document.querySelector('input[name="position"]:checked')?.value || 'start';
        const commonPhrase = document.getElementById('common-phrase').value || '';
        files.common.forEach(file => formData.append('files', file));
    
        files.common.forEach((_, index) => {
            let title = '';
            // const title = document.querySelector(`#file-list-common input[name="titles[${index}]"]`).value;
            // const filename = document.querySelector(`#file-list-common input[name="filenames[${index}]"]`).value;
            if (position === 'middle') {
                const part1 = document.querySelector(`#file-list-common input[name="title-part1-${index}"]`)?.value || '';
                const part2 = document.querySelector(`#file-list-common input[name="title-part2-${index}"]`)?.value || '';
                title = `${part1}|||${part2}`;
            } else {
                const titleInput = document.querySelector(`#file-list-common input[name="titles[${index}]"]`)
                // title = document.querySelector(`#file-list-common input[name="titles[${index}]"]`)?.value || '';
                title = titleInput ? titleInput.value : '';
            }

            const filenameInput = document.querySelector(`#file-list-common input[name="filenames[${index}]"]`);
            // const filename = document.querySelector(`#file-list-common input[name="filenames[${index}]"]`)?.value || '';
            const filename = filenameInput ? filenameInput.value : '';

            formData.append('titles', title);
            formData.append('filenames', filename);
        });
        // const position = document.querySelector('input[name="position"]:checked')?.value || 'start';
    
        formData.append('common_phrase', commonPhrase);
        formData.append('position', position);
    
        try {
            const response = await fetch('/upload_common', { method: 'POST', body: formData });
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Upload failed:', errorText);
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
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
    
            files.common = [];
            metadataTitles.common = [];
            renderFileList('common');
            updateEditButtonState('common');
        } catch (error) {
            alert('ネットワークエラーが発生しました。');
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
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            files.newrelease = [];
            metadataTitles.newrelease = [];
            renderNewreleaseList();
            updateEditButtonState('newrelease');
        } catch (error) {
            alert('ネットワークエラーが発生しました。');
        }
    });
});
