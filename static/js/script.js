document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const dropAreas = document.querySelectorAll('.drop-area');
    const fileLists = {
        normal: document.getElementById('file-list-normal'),
        sequential: document.getElementById('file-list-sequential'),
        common: document.getElementById('file-list-common')
    };
    const editButtons = {
        normal: document.getElementById('edit-normal'),
        sequential: document.getElementById('edit-sequential'),
        common: document.getElementById('edit-common')
    };
    const forms = {
        normal: document.getElementById('form-normal'),
        sequential: document.getElementById('form-sequential'),
        common: document.getElementById('form-common')
    };

    let files = { normal: [], sequential: [], common: [] };
    let metadataTitles = { normal: [], sequential: [], common: [] };

    function extractNumber(name) {
        const cleanedName = name.replace(/\d{6}_/, '');
        const match = cleanedName.match(/\d{2}(?!\d)/);
        if (match) return match[0];
        const longMatch = cleanedName.match(/\d{3,}/);
        return longMatch ? longMatch[0].slice(-2) : '';
    }

    function sortFilesByNumber(fileArray) {
        return fileArray.sort((a, b) => {
            const numA = extractNumber(a.name);
            const numB = extractNumber(b.name);
            if (!numA && !numB) return 0;
            if (!numA) return 1;
            if (!numB) return -1;
            return parseInt(numA, 10) - parseInt(numB, 10);
        });
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
            renderFileList(tab.dataset.tab);
        });
    });

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
            metadataTitles[tabId].push(...await fetchMetadataTitles(selectedFiles));
            renderFileList(tabId);
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
            updateEditButtonState(tabId);
            setTimeout(() => dropArea.classList.remove('uploading'), 500);
        });
    });

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
                    <label for="prefix">幹部分：</label>
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
            const existing = fileLists[tabId].querySelector('.common-controls');
            if (existing) fileLists[tabId].removeChild(existing);

            const wrapper = document.createElement('div');
            wrapper.classList.add('common-controls');

            const phraseGroup = document.createElement('div');
            phraseGroup.classList.add('input-group');
            phraseGroup.innerHTML = `
                <label for="common-phrase">共通語句：</label>
                <input type="text" id="common-phrase" name="common-phrase">
            `;
            wrapper.appendChild(phraseGroup);

            const radioGroup = document.createElement('div');
            radioGroup.classList.add('input-group', 'radio-group');
            radioGroup.innerHTML = `
                <label>位置：</label>
                <input type="radio" id="position-start" name="position" value="start" checked>
                <label for="position-start">先頭</label>
                <input type="radio" id="position-middle" name="position" value="middle">
                <label for="position-middle">中央</label>
                <input type="radio" id="position-end" name="position" value="end">
                <label for="position-end">末尾</label>
            `;
            wrapper.appendChild(radioGroup);
            fileLists[tabId].appendChild(wrapper);

            const positionRadios = wrapper.querySelectorAll('input[name="position"]');
            positionRadios.forEach(radio => {
                radio.addEventListener('change', () => renderFileList(tabId));
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

    function updateEditButtonState(tabId) {
        editButtons[tabId].disabled = files[tabId].length === 0;
    }
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
    

    forms.common.addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData();
        const position = document.querySelector('input[name="position"]:checked')?.value || 'start';
        const commonPhrase = document.getElementById('common-phrase').value || '';
    
        files.common.forEach(file => formData.append('files', file));
    
        files.common.forEach((_, index) => {
            let title = '';
            if (position === 'middle') {
                const part1 = document.querySelector(`#file-list-common input[name="title-part1-${index}"]`)?.value || '';
                const part2 = document.querySelector(`#file-list-common input[name="title-part2-${index}"]`)?.value || '';
                title = `${part1}|||${part2}`;
            } else {
                title = document.querySelector(`#file-list-common input[name="titles[${index}]"]`)?.value || '';
            }
    
            const filename = document.querySelector(`#file-list-common input[name="filenames[${index}]"]`)?.value || '';
            formData.append('titles', title);
            formData.append('filenames', filename);
        });
    
        formData.append('common_phrase', commonPhrase);
        formData.append('position', position);
    
        try {
            const response = await fetch('/upload_common', { method: 'POST', body: formData });
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
    
            files.common = [];
            metadataTitles.common = [];
            renderFileList('common');
            updateEditButtonState('common');
        } catch (error) {
            alert('ネットワークエラーが発生しました。');
        }
    });    
});
