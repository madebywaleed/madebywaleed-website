(function () {
  'use strict';

  var MAX_PDF_PAGES = 300;
  var MAX_SHEET_ROWS = 1048576;
  var MAX_SHEET_COLS = 16384;
  var MAX_PDF_PAGE_SIDE = 14400; // PDF page size limit, in points

  var MODES = {
    'csv-xlsx': {
      pipeline: 'PIPELINE: SHEETJS',
      multiple: false,
      title: 'Drag and drop a CSV or TSV file here, or browse',
      format: 'Supports CSV and TSV • One file at a time',
      chips: [],
      accept: '.csv,.tsv,text/csv,text/tab-separated-values',
      download: 'Download Excel (.xlsx)',
      isValid: function (f) {
        var ext = extOf(f.name);
        return ext === 'csv' || ext === 'tsv' || f.type === 'text/csv' || f.type === 'text/tab-separated-values';
      },
      typeName: 'CSV / TSV',
      convert: convertCsv
    },
    'img-pdf': {
      pipeline: 'PIPELINE: PDF-LIB',
      reorder: true,
      multiple: true,
      title: 'Drag and drop images here, or browse',
      format: 'Supports PNG, JPG, WEBP, AVIF • Add several to build one PDF',
      chips: [],
      accept: 'image/png,image/jpeg,image/webp,image/avif,.png,.jpg,.jpeg,.webp,.avif',
      download: 'Download PDF (.pdf)',
      isValid: function (f) {
        var ext = extOf(f.name);
        return ['png', 'jpg', 'jpeg', 'webp', 'avif'].indexOf(ext) !== -1 || /^image\/(png|jpeg|webp|avif)$/.test(f.type);
      },
      typeName: 'image',
      convert: convertImages
    },
    'merge-pdf': {
      pipeline: 'PIPELINE: PDF-LIB',
      multiple: true,
      reorder: true,
      title: 'Drag and drop PDFs here, or browse',
      format: 'Supports PDF • Add two or more, then put them in order',
      chips: [],
      accept: 'application/pdf,.pdf',
      download: 'Download PDF (.pdf)',
      isValid: function (f) {
        return extOf(f.name) === 'pdf' || f.type === 'application/pdf';
      },
      typeName: 'PDF',
      convert: convertMerge
    },
    'split-pdf': {
      pipeline: 'PIPELINE: PDF-LIB',
      multiple: false,
      reorder: false,
      title: 'Drag and drop a PDF here, or browse',
      format: 'Supports PDF • Split by page or page range',
      chips: [],
      accept: 'application/pdf,.pdf',
      download: 'Download result',
      isValid: function (f) {
        return extOf(f.name) === 'pdf' || f.type === 'application/pdf';
      },
      typeName: 'PDF',
      convert: convertSplit
    },
    'compress-pdf': {
      pipeline: 'PIPELINE: PDF.JS + PDF-LIB',
      multiple: false,
      reorder: false,
      title: 'Drag and drop a PDF here, or browse',
      format: 'Supports PDF • Pages are re-saved as images to reduce size',
      chips: [],
      accept: 'application/pdf,.pdf',
      download: 'Download result',
      isValid: function (f) {
        return extOf(f.name) === 'pdf' || f.type === 'application/pdf';
      },
      typeName: 'PDF',
      convert: convertCompress
    },
    'pdf-word': {
      pipeline: 'PIPELINE: PDF.JS + JSZIP',
      multiple: false,
      reorder: false,
      title: 'Drag and drop a PDF here, or browse',
      format: 'Supports text-based PDF • Layout and images are not kept',
      chips: [],
      accept: 'application/pdf,.pdf',
      download: 'Download result',
      isValid: function (f) {
        return extOf(f.name) === 'pdf' || f.type === 'application/pdf';
      },
      typeName: 'PDF',
      convert: convertPdfWord
    },
    'pdf-pptx': {
      pipeline: 'PIPELINE: PDF.JS + JSZIP',
      multiple: false,
      reorder: false,
      title: 'Drag and drop a PDF here, or browse',
      format: 'Supports PDF • One slide per page, pages kept as images',
      chips: [],
      accept: 'application/pdf,.pdf',
      download: 'Download result',
      isValid: function (f) {
        return extOf(f.name) === 'pdf' || f.type === 'application/pdf';
      },
      typeName: 'PDF',
      convert: convertPdfToPptx
    },
    'pdf-xlsx': {
      pipeline: 'PIPELINE: PDF.JS + SHEETJS',
      multiple: false,
      reorder: false,
      title: 'Drag and drop a PDF here, or browse',
      format: 'Supports text-based PDF • Works best with simple tables',
      chips: [],
      accept: 'application/pdf,.pdf',
      download: 'Download result',
      isValid: function (f) {
        return extOf(f.name) === 'pdf' || f.type === 'application/pdf';
      },
      typeName: 'PDF',
      convert: convertPdfExcel
    },
    'rotate-pdf': {
      pipeline: 'PIPELINE: PDF-LIB',
      multiple: false,
      reorder: false,
      title: 'Drag and drop a PDF here, or browse',
      format: 'Supports PDF • Rotate all pages or chosen ones',
      chips: [],
      accept: 'application/pdf,.pdf',
      download: 'Download result',
      isValid: isPdfFile,
      typeName: 'PDF',
      fields: [
        { id: 'rot-angle', type: 'select', label: 'Rotation', options: [['90', '90° clockwise'], ['270', '90° counter-clockwise'], ['180', '180°']] },
        { id: 'rot-pages', type: 'text', label: 'Pages to rotate', placeholder: 'e.g. 1-3, 5 (leave empty for all pages)' }
      ],
      convert: convertRotate
    },
    'crop-pdf': {
      pipeline: 'PIPELINE: PDF-LIB',
      multiple: false,
      reorder: false,
      title: 'Drag and drop a PDF here, or browse',
      format: 'Supports PDF • Trims the same margin from every page',
      chips: [],
      accept: 'application/pdf,.pdf',
      download: 'Download result',
      isValid: isPdfFile,
      typeName: 'PDF',
      fields: [
        { id: 'crop-margin', type: 'text', inputmode: 'numeric', label: 'Margin to remove from each edge (points)', placeholder: 'e.g. 20 (72 points = 1 inch)', value: '20' }
      ],
      convert: convertCrop
    },
    'page-numbers': {
      pipeline: 'PIPELINE: PDF-LIB',
      multiple: false,
      reorder: false,
      title: 'Drag and drop a PDF here, or browse',
      format: 'Supports PDF • Adds a number to every page',
      chips: [],
      accept: 'application/pdf,.pdf',
      download: 'Download result',
      isValid: isPdfFile,
      typeName: 'PDF',
      fields: [
        { id: 'pn-position', type: 'select', label: 'Position', options: [['bottom-center', 'Bottom centre'], ['bottom-right', 'Bottom right'], ['bottom-left', 'Bottom left'], ['top-center', 'Top centre'], ['top-right', 'Top right']] },
        { id: 'pn-start', type: 'text', inputmode: 'numeric', label: 'Number for the first page', value: '1' }
      ],
      convert: convertPageNumbers
    },
    'watermark-pdf': {
      pipeline: 'PIPELINE: PDF-LIB',
      multiple: false,
      reorder: false,
      title: 'Drag and drop a PDF here, or browse',
      format: 'Supports PDF • Stamps text across each page',
      chips: [],
      accept: 'application/pdf,.pdf',
      download: 'Download result',
      isValid: isPdfFile,
      typeName: 'PDF',
      fields: [
        { id: 'wm-text', type: 'text', label: 'Watermark text', placeholder: 'e.g. CONFIDENTIAL', value: 'CONFIDENTIAL', hint: 'English letters, numbers and common symbols only.' }
      ],
      convert: convertWatermark
    },
    'organize-pdf': {
      pipeline: 'PIPELINE: PDF-LIB',
      multiple: false,
      reorder: false,
      title: 'Drag and drop a PDF here, or browse',
      format: 'Supports PDF • Reorder or remove pages',
      chips: [],
      accept: 'application/pdf,.pdf',
      download: 'Download result',
      isValid: isPdfFile,
      typeName: 'PDF',
      fields: [
        { id: 'org-order', type: 'text', label: 'New page order', placeholder: 'e.g. 3, 1, 2 (leave empty to keep the current order)' },
        { id: 'org-remove', type: 'text', label: 'Pages to remove', placeholder: 'e.g. 2, 5-6 (optional)' }
      ],
      convert: convertOrganize
    },
    'sign-pdf': {
      pipeline: 'PIPELINE: PDF-LIB',
      multiple: false,
      reorder: false,
      title: 'Drag and drop a PDF here, or browse',
      format: 'Supports PDF • Adds a typed signature',
      chips: [],
      accept: 'application/pdf,.pdf',
      download: 'Download result',
      isValid: isPdfFile,
      typeName: 'PDF',
      fields: [
        { id: 'sign-text', type: 'text', label: 'Your name (typed signature)', placeholder: 'e.g. Waleed Khan', hint: 'English letters only. A drawn signature is not available yet.' },
        { id: 'sign-page', type: 'text', inputmode: 'numeric', label: 'Page to sign', placeholder: 'Leave empty for the last page' },
        { id: 'sign-position', type: 'select', label: 'Position', options: [['bottom-right', 'Bottom right'], ['bottom-left', 'Bottom left'], ['bottom-center', 'Bottom centre']] }
      ],
      convert: convertSign
    },
    'redact-pdf': {
      pipeline: 'PIPELINE: PDF.JS + PDF-LIB',
      multiple: false,
      reorder: false,
      title: 'Drag and drop a PDF here, or browse',
      format: 'Supports text-based PDF • Matched text is removed',
      chips: [],
      accept: 'application/pdf,.pdf',
      download: 'Download result',
      isValid: isPdfFile,
      typeName: 'PDF',
      fields: [
        { id: 'redact-terms', type: 'text', label: 'Words or phrases to redact', placeholder: 'e.g. 03001234567, John Smith', hint: 'Separate items with commas. Matching works inside a single line of text, so a phrase split across lines may be missed. Pages are flattened to images.' }
      ],
      convert: convertRedact
    },
    'scan-pdf': {
      pipeline: 'PIPELINE: PDF-LIB',
      multiple: true,
      reorder: true,
      title: 'Take a photo, or drop images here',
      format: 'Supports PNG, JPG, WEBP, AVIF • Put the pages in order',
      chips: [],
      accept: 'image/png,image/jpeg,image/webp,image/avif,.png,.jpg,.jpeg,.webp,.avif',
      download: 'Download PDF (.pdf)',
      isValid: MODES_IMAGE_VALID,
      typeName: 'image',
      fields: [],
      convert: convertImages
    },
    'pdf-markdown': {
      pipeline: 'PIPELINE: PDF.JS',
      multiple: false,
      reorder: false,
      title: 'Drag and drop a PDF here, or browse',
      format: 'Supports text-based PDF • Text only',
      chips: [],
      accept: 'application/pdf,.pdf',
      download: 'Download result',
      isValid: isPdfFile,
      typeName: 'PDF',
      convert: convertPdfMarkdown
    },
    'edit-pdf': {
      pipeline: 'PIPELINE: PDF-LIB',
      multiple: false,
      reorder: false,
      title: 'Drag and drop a PDF here, or browse',
      format: 'Supports PDF • Adds text at a chosen position',
      chips: [],
      accept: 'application/pdf,.pdf',
      download: 'Download result',
      isValid: isPdfFile,
      typeName: 'PDF',
      fields: [
        { id: 'edit-text', type: 'textarea', label: 'Text to add', placeholder: 'Type the text here. Use a new line for each line of text.', hint: 'English letters, numbers and common symbols only.' },
        { id: 'edit-page', type: 'text', inputmode: 'numeric', label: 'Page', placeholder: 'Leave empty for the first page' },
        { id: 'edit-position', type: 'select', label: 'Position', options: [['top-left', 'Top left'], ['top-center', 'Top centre'], ['top-right', 'Top right'], ['middle-left', 'Middle left'], ['middle-center', 'Middle centre'], ['middle-right', 'Middle right'], ['bottom-left', 'Bottom left'], ['bottom-center', 'Bottom centre'], ['bottom-right', 'Bottom right']] },
        { id: 'edit-size', type: 'text', inputmode: 'numeric', label: 'Font size', value: '14' },
        { id: 'edit-color', type: 'select', label: 'Colour', options: [['black', 'Black'], ['blue', 'Blue'], ['red', 'Red']] }
      ],
      convert: convertEditPdf
    },
    'compare-pdf': {
      pipeline: 'PIPELINE: PDF.JS + PDF-LIB',
      multiple: true,
      reorder: true,
      title: 'Drag in the old PDF, then the new PDF',
      format: 'Supports PDF • Add exactly two files, old first',
      chips: [],
      accept: 'application/pdf,.pdf',
      download: 'Download result',
      isValid: isPdfFile,
      typeName: 'PDF',
      fields: [],
      convert: convertComparePdf
    },
    'repair-pdf': {
      pipeline: 'PIPELINE: PDF-LIB',
      multiple: false,
      reorder: false,
      title: 'Drag and drop a damaged PDF here, or browse',
      format: 'Supports PDF • Rebuilds the file structure',
      chips: [],
      accept: 'application/pdf,.pdf',
      download: 'Download result',
      isValid: isPdfFile,
      typeName: 'PDF',
      convert: convertRepairPdf
    },
    'html-pdf': {
      pipeline: 'PIPELINE: HTML2CANVAS + PDF-LIB',
      multiple: false,
      reorder: false,
      noFile: true,
      title: 'Paste HTML below',
      format: 'No file needed • A4 pages',
      chips: [],
      accept: '',
      download: 'Download result',
      isValid: isPdfFile,
      typeName: 'HTML',
      fields: [
        { id: 'html-source', type: 'textarea', label: 'HTML to convert', placeholder: '<h1>Title</h1>\n<p>Paste your HTML here.</p>', hint: 'Scripts, iframes and style blocks are removed. Use inline styles for formatting. Web addresses and external images are not loaded.' }
      ],
      convert: convertHtmlPdf
    },
    'ocr-pdf': {
      pipeline: 'PIPELINE: TESSERACT.JS',
      multiple: false,
      reorder: false,
      title: 'Drag and drop a scanned PDF here, or browse',
      format: 'Supports PDF • English text, one page at a time',
      chips: [],
      accept: 'application/pdf,.pdf',
      download: 'Download result',
      isValid: isPdfFile,
      typeName: 'PDF',
      convert: convertOcrPdf
    },
    'forms-pdf': {
      pipeline: 'PIPELINE: PDF-LIB',
      multiple: false,
      reorder: false,
      title: 'Drag and drop a PDF here, or browse',
      format: 'Supports PDF • Adds fillable fields to one page',
      chips: [],
      accept: 'application/pdf,.pdf',
      download: 'Download result',
      isValid: isPdfFile,
      typeName: 'PDF',
      fields: [
        { id: 'form-fields', type: 'textarea', label: 'Fields to add (one per line)', placeholder: 'Full name\nEmail\nI agree to the terms [checkbox]', hint: 'Add [checkbox] at the end of a line to make a checkbox instead of a text field.' },
        { id: 'form-page', type: 'text', inputmode: 'numeric', label: 'Page', placeholder: 'Leave empty for the first page' }
      ],
      convert: convertFormsPdf
    },
    'pdf-img': {
      pipeline: 'PIPELINE: PDF.JS',
      multiple: false,
      title: 'Drag and drop a PDF here, or browse',
      format: 'Supports PDF • Up to ' + MAX_PDF_PAGES + ' pages',
      chips: [],
      accept: 'application/pdf,.pdf',
      download: 'Download result',
      isValid: function (f) {
        return extOf(f.name) === 'pdf' || f.type === 'application/pdf';
      },
      typeName: 'PDF',
      convert: convertPdf
    }
  };

  var state = { mode: document.body.getAttribute('data-mode') || 'csv-xlsx', files: [], result: null, busy: false, hash: '' };

  var el = {
    dropzone: document.getElementById('dropzone'),
    input: document.getElementById('file-input'),
    dropTitle: document.getElementById('drop-title'),
    dropFormat: document.getElementById('drop-format'),
    chips: document.getElementById('chips'),
    queue: document.getElementById('queue'),
    queueCount: document.getElementById('queue-count'),
    pipeline: document.getElementById('pipeline'),
    progress: document.getElementById('progress'),
    progressLabel: document.getElementById('progress-label'),
    progressPercent: document.getElementById('progress-percent'),
    progressFill: document.getElementById('progress-fill'),
    status: document.getElementById('status'),
    convert: document.getElementById('convert'),
    reset: document.getElementById('reset'),
    download: document.getElementById('download'),
    sysState: document.getElementById('sys-state'),
    hash: document.getElementById('hash')
  };

  function extOf(name) {
    var i = name.lastIndexOf('.');
    return i === -1 ? '' : name.slice(i + 1).toLowerCase();
  }

  function baseName(name) {
    var i = name.lastIndexOf('.');
    return i > 0 ? name.slice(0, i) : name;
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function setStatus(msg, kind) {
    el.status.textContent = msg || '';
    el.status.className = 'status' + (kind ? ' ' + kind : '');
  }

  function setProgress(percent, label) {
    el.progress.hidden = false;
    el.progressFill.style.width = Math.max(0, Math.min(100, percent)) + '%';
    el.progressPercent.textContent = Math.round(percent) + '%';
    el.progressLabel.textContent = label || 'Working...';
  }

  function hideProgress() {
    el.progress.hidden = true;
    el.progressFill.style.width = '0%';
  }

  function setBusy(busy) {
    state.busy = busy;
    el.convert.disabled = busy;
    el.reset.disabled = busy;
    if (el.sysState) el.sysState.textContent = busy ? 'WORKING' : 'READY';
  }

  function renderHeader() {
    var m = MODES[state.mode];
    if (el.pipeline) el.pipeline.textContent = m.pipeline;
    el.dropTitle.textContent = m.title;
    el.dropFormat.textContent = m.format;
    el.chips.innerHTML = '';
    m.chips.forEach(function (c, i) {
      var s = document.createElement('span');
      s.className = 'chip' + (i === m.chips.length - 1 ? ' accent' : '');
      s.textContent = c;
      el.chips.appendChild(s);
    });
    el.input.setAttribute('accept', m.accept);
    el.input.multiple = m.multiple;
    var splitField = document.getElementById('split-field');
    if (splitField) splitField.hidden = state.mode !== 'split-pdf';
    var compressField = document.getElementById('compress-field');
    if (compressField) compressField.hidden = state.mode !== 'compress-pdf';

    // Settings for the newer tools, built from each mode's `fields` list.
    var optionsBox = document.getElementById('mode-options');
    if (optionsBox) {
      optionsBox.innerHTML = '';
      var fields = m.fields || [];
      optionsBox.hidden = fields.length === 0;
      fields.forEach(function (f) {
        var wrap = document.createElement('div');
        wrap.style.marginTop = '0.75rem';
        var lab = document.createElement('label');
        lab.className = 'label';
        lab.htmlFor = f.id;
        lab.style.display = 'block';
        lab.style.marginBottom = '0.5rem';
        lab.textContent = f.label;
        var input;
        if (f.type === 'textarea') {
          input = document.createElement('textarea');
          input.rows = 5;
          input.placeholder = f.placeholder || '';
          input.value = f.value || '';
          input.style.resize = 'vertical';
        } else if (f.type === 'select') {
          input = document.createElement('select');
          (f.options || []).forEach(function (o) {
            var op = document.createElement('option');
            op.value = o[0];
            op.textContent = o[1];
            input.appendChild(op);
          });
        } else {
          input = document.createElement('input');
          input.type = 'text';
          input.autocomplete = 'off';
          if (f.inputmode) input.inputMode = f.inputmode;
          if (f.placeholder) input.placeholder = f.placeholder;
          input.value = f.value || '';
        }
        input.id = f.id;
        input.className = 'field-input';
        wrap.appendChild(lab);
        wrap.appendChild(input);
        if (f.hint) {
          var hint = document.createElement('p');
          hint.className = 'field-hint';
          hint.textContent = f.hint;
          wrap.appendChild(hint);
        }
        optionsBox.appendChild(wrap);
      });
    }

    // Some tools take typed input instead of a file, so hide the file drop area and queue for them.
    var noFile = !!m.noFile;
    el.dropzone.parentElement.hidden = noFile;
    el.queue.parentElement.hidden = noFile;

    // Scan to PDF opens the phone camera where the browser supports it.
    if (state.mode === 'scan-pdf') el.input.setAttribute('capture', 'environment');
    else el.input.removeAttribute('capture');
    el.download.textContent = result2label();
  }

  function result2label() {
    if (state.result) return 'Download ' + state.result.ext;
    return MODES[state.mode].download;
  }

  function renderQueue() {
    el.queue.innerHTML = '';
    if (state.files.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'queue-empty';
      empty.textContent = 'No files yet. Drop a file above or choose one to start.';
      el.queue.appendChild(empty);
    }
    state.files.forEach(function (f, idx) {
      var row = document.createElement('div');
      row.className = 'item';

      var left = document.createElement('div');
      left.className = 'item-left';

      var icon = document.createElement('div');
      icon.className = 'item-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';

      var body = document.createElement('div');
      body.className = 'item-body';

      var name = document.createElement('span');
      name.className = 'item-name';
      name.textContent = f.name;
      name.title = f.name;

      var sub = document.createElement('div');
      sub.className = 'item-sub';
      var ready = document.createElement('span');
      ready.className = 'ready';
      ready.textContent = 'READY';
      var type = document.createElement('span');
      type.textContent = 'TYPE: ' + MODES[state.mode].typeName.toUpperCase() + ' • ' + formatSize(f.size);
      sub.appendChild(ready);
      sub.appendChild(type);

      body.appendChild(name);
      body.appendChild(sub);
      left.appendChild(icon);
      left.appendChild(body);

      var remove = document.createElement('button');
      remove.className = 'remove';
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Remove ' + f.name);
      remove.textContent = '×';
      remove.disabled = state.busy;
      remove.addEventListener('click', function () { removeFile(idx); });

      row.appendChild(left);
      if (MODES[state.mode].reorder) {
        var up = document.createElement('button');
        up.className = 'remove move';
        up.type = 'button';
        up.textContent = '↑';
        up.setAttribute('aria-label', 'Move ' + f.name + ' up');
        up.disabled = state.busy || idx === 0;
        up.addEventListener('click', function () { moveFile(idx, -1); });

        var down = document.createElement('button');
        down.className = 'remove move';
        down.type = 'button';
        down.textContent = '↓';
        down.setAttribute('aria-label', 'Move ' + f.name + ' down');
        down.disabled = state.busy || idx === state.files.length - 1;
        down.addEventListener('click', function () { moveFile(idx, 1); });

        row.appendChild(up);
        row.appendChild(down);
      }
      row.appendChild(remove);
      el.queue.appendChild(row);
    });
    el.queueCount.textContent = state.files.length + (state.files.length === 1 ? ' item staged' : ' items staged');
    el.convert.disabled = state.busy || (state.files.length === 0 && !MODES[state.mode].noFile);
  }

  function moveFile(idx, dir) {
    var j = idx + dir;
    if (state.busy || j < 0 || j >= state.files.length) return;
    var tmp = state.files[idx];
    state.files[idx] = state.files[j];
    state.files[j] = tmp;
    clearResult();
    renderQueue();
  }

  function clearResult() {
    state.result = null;
    el.download.disabled = true;
    el.download.textContent = result2label();
  }

  function removeFile(idx) {
    state.files.splice(idx, 1);
    clearResult();
    state.hash = '';
    renderQueue();
    refreshHash();
    setStatus('', '');
  }

  function refreshHash() {
    if (el.hash) el.hash.textContent = 'SHA-256: —';
    if (!state.files.length || !window.crypto || !crypto.subtle) return;
    var first = state.files[0];
    var token = first.name + first.size + first.lastModified;
    first.arrayBuffer().then(function (buf) {
      return crypto.subtle.digest('SHA-256', buf);
    }).then(function (digest) {
      var hex = Array.prototype.map.call(new Uint8Array(digest), function (b) {
        return ('0' + b.toString(16)).slice(-2);
      }).join('');
      if (state.files.length && (state.files[0].name + state.files[0].size + state.files[0].lastModified) === token) {
        if (el.hash) el.hash.textContent = 'SHA-256: ' + hex.slice(0, 4) + '...' + hex.slice(-4);
      }
    }).catch(function () { /* hash is decorative; ignore failures */ });
  }

  function addFiles(list) {
    if (state.busy) return;
    var m = MODES[state.mode];
    var incoming = Array.prototype.slice.call(list || []);
    if (!incoming.length) return;

    var valid = incoming.filter(function (f) { return m.isValid(f); });
    var rejected = incoming.length - valid.length;

    if (!valid.length) {
      setStatus('That file type is not supported here. ' + m.format.replace('Supports ', 'Supported: ') + '.', 'error');
      return;
    }

    clearResult();
    var messages = [];
    if (m.multiple) {
      valid.forEach(function (f) {
        var dup = state.files.some(function (x) { return x.name === f.name && x.size === f.size; });
        if (!dup) state.files.push(f);
      });
    } else {
      if (valid.length > 1) messages.push('Only one file at a time. Using ' + valid[0].name + '.');
      state.files = [valid[0]];
    }
    if (rejected) messages.push(rejected + ' file' + (rejected === 1 ? ' was' : 's were') + ' skipped because the type is not supported.');

    renderQueue();
    refreshHash();
    setStatus(messages.join(' '), messages.length ? 'error' : '');
  }

  function resetAll() {
    if (state.busy) return;
    state.files = [];
    clearResult();
    renderQueue();
    refreshHash();
    hideProgress();
    setStatus('', '');
  }

  function saveBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function canvasToBlob(canvas, type) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) {
        if (b) resolve(b); else reject(new Error('Could not create the image.'));
      }, type);
    });
  }

  function requireLib(lib, label) {
    if (typeof window[lib] === 'undefined') {
      throw new Error('The ' + label + ' library did not load. Check your connection and refresh the page.');
    }
  }

  /* ---------- CSV to Excel ---------- */

  function detectDelimiter(text, name) {
    if (extOf(name) === 'tsv') return '\t';
    var firstLine = text.split(/\r?\n/, 1)[0] || '';
    var tabs = (firstLine.match(/\t/g) || []).length;
    var commas = (firstLine.match(/,/g) || []).length;
    return tabs > commas ? '\t' : ',';
  }

  // RFC 4180-style parser: quoted fields, doubled quotes, CR/LF/CRLF line endings.
  function parseDelimited(text, delim) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var i = 0;
    var n = text.length;

    while (i < n) {
      var c = text.charAt(i);
      if (inQuotes) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"' && field === '') { inQuotes = true; i++; continue; }
      if (c === delim) { row.push(field); field = ''; i++; continue; }
      if (c === '\r' || c === '\n') {
        row.push(field); rows.push(row); row = []; field = '';
        i += (c === '\r' && text.charAt(i + 1) === '\n') ? 2 : 1;
        continue;
      }
      field += c; i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  // Keep plain numbers as numbers so Excel can sort and sum them. Leave leading-zero codes (like 007) as text.
  function toCell(v) {
    if (v === '') return '';
    if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(v) && v.replace(/\D/g, '').length <= 15) return Number(v);
    return v;
  }

  async function convertCsv(files, progress) {
    requireLib('XLSX', 'spreadsheet');
    var file = files[0];
    progress(10, 'Reading file...');
    var text = (await file.text()).replace(/^﻿/, '');
    if (!text.trim()) throw new Error('This file is empty.');

    var delim = detectDelimiter(text, file.name);
    progress(35, 'Parsing rows...');
    var rows = parseDelimited(text, delim);
    if (rows.length > MAX_SHEET_ROWS) {
      throw new Error('This file has ' + rows.length.toLocaleString() + ' rows. Excel allows up to 1,048,576 per sheet.');
    }
    var widest = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    if (widest > MAX_SHEET_COLS) {
      throw new Error('This file has ' + widest.toLocaleString() + ' columns. Excel allows up to 16,384.');
    }

    progress(60, 'Building workbook...');
    var data = rows.map(function (r) { return r.map(toCell); });
    var ws = XLSX.utils.aoa_to_sheet(data);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

    progress(85, 'Writing .xlsx...');
    var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    progress(100, 'Done');

    return {
      blob: new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      filename: baseName(file.name) + '.xlsx',
      ext: '.xlsx',
      summary: rows.length.toLocaleString() + ' rows'
    };
  }

  /* ---------- Images to PDF ---------- */

  async function rasterToPng(file) {
    var bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch (e) {
      throw new Error('Could not read the image ' + file.name + '.');
    }
    var canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    bitmap.close && bitmap.close();
    var blob = await canvasToBlob(canvas, 'image/png');
    canvas.width = 0; canvas.height = 0;
    return new Uint8Array(await blob.arrayBuffer());
  }

  async function convertImages(files, progress) {
    requireLib('PDFLib', 'PDF');
    var PDFDocument = PDFLib.PDFDocument;
    var doc = await PDFDocument.create();

    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      progress((i / files.length) * 90, 'Adding image ' + (i + 1) + ' of ' + files.length + '...');
      var bytes = new Uint8Array(await f.arrayBuffer());
      var ext = extOf(f.name);
      var img = null;

      try {
        if (f.type === 'image/png' || ext === 'png') img = await doc.embedPng(bytes);
        else if (f.type === 'image/jpeg' || ext === 'jpg' || ext === 'jpeg') img = await doc.embedJpg(bytes);
      } catch (e) {
        img = null; // unusual encoding (e.g. CMYK JPEG): fall back to re-encoding below
      }
      if (!img) {
        img = await doc.embedPng(await rasterToPng(f));
      }

      var w = img.width;
      var h = img.height;
      var scale = Math.min(1, MAX_PDF_PAGE_SIDE / Math.max(w, h));
      w = w * scale; h = h * scale;
      var page = doc.addPage([w, h]);
      page.drawImage(img, { x: 0, y: 0, width: w, height: h });
    }

    progress(95, 'Saving PDF...');
    var out = await doc.save();
    progress(100, 'Done');

    return {
      blob: new Blob([out], { type: 'application/pdf' }),
      filename: files.length === 1 ? baseName(files[0].name) + '.pdf' : 'converted-images.pdf',
      ext: '.pdf',
      summary: files.length + ' page' + (files.length === 1 ? '' : 's')
    };
  }

  /* ---------- PDF to Images ---------- */

  async function convertPdf(files, progress) {
    requireLib('pdfjsLib', 'PDF');
    requireLib('JSZip', 'ZIP');
    var file = files[0];
    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    progress(5, 'Reading PDF...');
    var buf = await file.arrayBuffer();
    var pdf;
    try {
      pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    } catch (e) {
      if (e && e.name === 'PasswordException') {
        throw new Error('This PDF is password protected. Unlock it first, then try again.');
      }
      throw new Error('Could not read this PDF. The file may be damaged.');
    }

    var count = pdf.numPages;
    if (count > MAX_PDF_PAGES) {
      throw new Error('This PDF has ' + count + ' pages. The limit is ' + MAX_PDF_PAGES + ' pages per conversion.');
    }

    var pages = [];
    for (var p = 1; p <= count; p++) {
      progress(5 + ((p - 1) / count) * 90, 'Rendering page ' + p + ' of ' + count + '...');
      var page = await pdf.getPage(p);
      var base = page.getViewport({ scale: 1 });
      var scale = Math.min(2, 4096 / Math.max(base.width, base.height));
      var viewport = page.getViewport({ scale: scale });

      var canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
      pages.push(await canvasToBlob(canvas, 'image/png'));
      canvas.width = 0; canvas.height = 0;
      page.cleanup();
    }
    pdf.destroy && pdf.destroy();

    var name = baseName(file.name);
    if (count === 1) {
      progress(100, 'Done');
      return { blob: pages[0], filename: name + '-page-1.png', ext: '.png', summary: '1 page' };
    }

    progress(96, 'Packing ZIP...');
    var zip = new JSZip();
    var width = String(count).length;
    pages.forEach(function (b, i) {
      zip.file(name + '-page-' + String(i + 1).padStart(width, '0') + '.png', b);
    });
    var out = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    progress(100, 'Done');
    return { blob: out, filename: name + '-pages.zip', ext: '.zip', summary: count + ' pages' };
  }

  /* ---------- Merge PDF ---------- */

  async function convertMerge(files, progress) {
    requireLib('PDFLib', 'PDF');
    if (files.length < 2) throw new Error('Add at least two PDFs to merge.');

    var out = await PDFLib.PDFDocument.create();
    var pageCount = 0;
    for (var i = 0; i < files.length; i++) {
      progress(5 + (i / files.length) * 85, 'Adding PDF ' + (i + 1) + ' of ' + files.length + '...');
      var src;
      try {
        src = await PDFLib.PDFDocument.load(new Uint8Array(await files[i].arrayBuffer()));
      } catch (e) {
        throw new Error(files[i].name + ' could not be read. It may be password protected or damaged.');
      }
      var copied = await out.copyPages(src, src.getPageIndices());
      for (var k = 0; k < copied.length; k++) out.addPage(copied[k]);
      pageCount += copied.length;
    }

    progress(95, 'Saving PDF...');
    var bytes = await out.save();
    progress(100, 'Done');

    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      filename: 'merged.pdf',
      ext: '.pdf',
      summary: files.length + ' files, ' + pageCount + ' pages'
    };
  }

  /* ---------- Split PDF ---------- */

  // "1-3, 5, 8-10" -> [[1,3],[5,5],[8,10]]. Empty means every page on its own.
  function parsePageSpec(spec, count) {
    var text = (spec || '').trim();
    if (!text) {
      var all = [];
      for (var p = 1; p <= count; p++) all.push([p, p]);
      return all;
    }
    var parts = text.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
    return parts.map(function (t) {
      var m = t.match(/^(\d+)\s*-\s*(\d+)$/) || t.match(/^(\d+)$/);
      if (!m) throw new Error("'" + t + "' is not a valid page or range. Use values like 3, 1-4, or 2, 5-7.");
      var a = parseInt(m[1], 10);
      var b = m[2] ? parseInt(m[2], 10) : a;
      if (a > b) throw new Error("The range '" + t + "' starts after it ends.");
      if (a < 1 || b > count) throw new Error("The range '" + t + "' is outside this PDF, which has " + count + " pages.");
      return [a, b];
    });
  }

  async function convertSplit(files, progress) {
    requireLib('PDFLib', 'PDF');
    requireLib('JSZip', 'ZIP');
    var file = files[0];

    progress(5, 'Reading PDF...');
    var src;
    try {
      src = await PDFLib.PDFDocument.load(new Uint8Array(await file.arrayBuffer()));
    } catch (e) {
      throw new Error('Could not read this PDF. It may be password protected or damaged.');
    }

    var count = src.getPageCount();
    var ranges = parsePageSpec(document.getElementById('split-pages').value, count);
    if (ranges.length > MAX_PDF_PAGES) {
      throw new Error('That makes ' + ranges.length + ' files. The limit is ' + MAX_PDF_PAGES + ' per conversion.');
    }

    var name = baseName(file.name);
    var outputs = [];
    for (var i = 0; i < ranges.length; i++) {
      progress(5 + (i / ranges.length) * 85, 'Writing part ' + (i + 1) + ' of ' + ranges.length + '...');
      var a = ranges[i][0];
      var b = ranges[i][1];
      var indices = [];
      for (var q = a - 1; q <= b - 1; q++) indices.push(q);

      var doc = await PDFLib.PDFDocument.create();
      var copied = await doc.copyPages(src, indices);
      for (var k = 0; k < copied.length; k++) doc.addPage(copied[k]);

      var label = a === b ? 'page-' + a : 'pages-' + a + '-' + b;
      outputs.push({ name: name + '-' + label + '.pdf', bytes: await doc.save() });
    }

    progress(95, 'Packing...');
    if (outputs.length === 1) {
      progress(100, 'Done');
      return {
        blob: new Blob([outputs[0].bytes], { type: 'application/pdf' }),
        filename: outputs[0].name,
        ext: '.pdf',
        summary: '1 PDF'
      };
    }

    var zip = new JSZip();
    outputs.forEach(function (o) { zip.file(o.name, o.bytes); });
    var zipped = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    progress(100, 'Done');
    return { blob: zipped, filename: name + '-split.zip', ext: '.zip', summary: outputs.length + ' PDFs' };
  }

  /* ---------- Compress PDF ---------- */

  // Each level sets the render scale (1 = 72 dpi) and JPEG quality (0-1).
  var COMPRESS_PRESETS = {
    light: { scale: 1.5, quality: 0.85 },
    medium: { scale: 1.2, quality: 0.7 },
    strong: { scale: 1, quality: 0.5 }
  };

  async function convertCompress(files, progress) {
    requireLib('PDFLib', 'PDF');
    requireLib('pdfjsLib', 'PDF');
    var file = files[0];
    var levelEl = document.getElementById('compress-level');
    var preset = COMPRESS_PRESETS[levelEl ? levelEl.value : 'medium'] || COMPRESS_PRESETS.medium;

    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    progress(5, 'Reading PDF...');
    var pdf;
    try {
      pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    } catch (e) {
      if (e && e.name === 'PasswordException') {
        throw new Error('This PDF is password protected. Unlock it first, then try again.');
      }
      throw new Error('Could not read this PDF. The file may be damaged.');
    }

    var count = pdf.numPages;
    if (count > MAX_PDF_PAGES) {
      throw new Error('This PDF has ' + count + ' pages. The limit is ' + MAX_PDF_PAGES + ' pages per conversion.');
    }

    var out = await PDFLib.PDFDocument.create();
    for (var p = 1; p <= count; p++) {
      progress(5 + ((p - 1) / count) * 90, 'Compressing page ' + p + ' of ' + count + '...');
      var page = await pdf.getPage(p);
      var base = page.getViewport({ scale: 1 });
      var viewport = page.getViewport({ scale: preset.scale });

      var canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;

      var jpeg = await new Promise(function (resolve, reject) {
        canvas.toBlob(function (b) {
          if (b) resolve(b); else reject(new Error('Could not compress page ' + p + '.'));
        }, 'image/jpeg', preset.quality);
      });
      canvas.width = 0; canvas.height = 0;
      page.cleanup();

      var img = await out.embedJpg(new Uint8Array(await jpeg.arrayBuffer()));
      var pg = out.addPage([base.width, base.height]);
      pg.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
    }
    pdf.destroy && pdf.destroy();

    progress(96, 'Saving PDF...');
    var bytes = await out.save();
    progress(100, 'Done');

    if (bytes.length >= file.size) {
      return {
        blob: file,
        filename: baseName(file.name) + '-compressed.pdf',
        ext: '.pdf',
        summary: 'could not be made smaller, so the original is returned'
      };
    }
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      filename: baseName(file.name) + '-compressed.pdf',
      ext: '.pdf',
      summary: formatSize(file.size) + ' → ' + formatSize(bytes.length)
    };
  }

  /* ---------- PDF to Word (text only) ---------- */

  // Group positioned text fragments into lines, top to bottom, left to right.
  function textToLines(items) {
    var rows = [];
    items.forEach(function (it) {
      if (!it.str) return;
      var row = null;
      for (var r = 0; r < rows.length; r++) {
        if (Math.abs(rows[r].y - it.y) <= 2) { row = rows[r]; break; }
      }
      if (!row) { row = { y: it.y, items: [] }; rows.push(row); }
      row.items.push(it);
    });
    rows.sort(function (a, b) { return b.y - a.y; });
    return rows.map(function (row) {
      row.items.sort(function (a, b) { return a.x - b.x; });
      var text = '';
      var lastEnd = null;
      row.items.forEach(function (it) {
        if (lastEnd !== null && it.x - lastEnd > 2 && text && !/\s$/.test(text) && !/^\s/.test(it.str)) text += ' ';
        text += it.str;
        lastEnd = it.x + (it.width || 0);
      });
      return { y: row.y, text: text.replace(/\s+/g, ' ').trim() };
    }).filter(function (r) { return r.text; });
  }

  // Join lines into paragraphs. A bigger-than-normal gap between lines starts a new paragraph.
  function linesToParagraphs(lines) {
    if (!lines.length) return [];
    var gaps = [];
    for (var i = 1; i < lines.length; i++) gaps.push(lines[i - 1].y - lines[i].y);
    gaps.sort(function (a, b) { return a - b; });
    var median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;

    var paragraphs = [];
    var current = lines[0].text;
    for (var j = 1; j < lines.length; j++) {
      var gap = lines[j - 1].y - lines[j].y;
      if (median && gap > median * 1.6) {
        paragraphs.push(current);
        current = lines[j].text;
      } else {
        current += ' ' + lines[j].text;
      }
    }
    paragraphs.push(current);
    return paragraphs;
  }

  function xmlEscape(s) {
    return s
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function buildDocumentXml(pages) {
    var body = '';
    pages.forEach(function (paragraphs, pi) {
      if (pi > 0) body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      paragraphs.forEach(function (t) {
        body += '<w:p><w:r><w:t xml:space="preserve">' + xmlEscape(t) + '</w:t></w:r></w:p>';
      });
    });
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      body + '<w:sectPr/></w:body></w:document>';
  }

  async function convertPdfWord(files, progress) {
    requireLib('pdfjsLib', 'PDF');
    requireLib('JSZip', 'ZIP');
    var file = files[0];
    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    progress(5, 'Reading PDF...');
    var pdf;
    try {
      pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    } catch (e) {
      if (e && e.name === 'PasswordException') {
        throw new Error('This PDF is password protected. Unlock it first, then try again.');
      }
      throw new Error('Could not read this PDF. The file may be damaged.');
    }

    var count = pdf.numPages;
    if (count > MAX_PDF_PAGES) {
      throw new Error('This PDF has ' + count + ' pages. The limit is ' + MAX_PDF_PAGES + ' pages per conversion.');
    }

    var pages = [];
    var totalText = 0;
    for (var p = 1; p <= count; p++) {
      progress(5 + ((p - 1) / count) * 85, 'Reading text from page ' + p + ' of ' + count + '...');
      var page = await pdf.getPage(p);
      var content = await page.getTextContent();
      var items = content.items.map(function (i) {
        return { str: i.str, x: i.transform[4], y: i.transform[5], width: i.width };
      });
      var lines = textToLines(items);
      totalText += lines.length;
      pages.push(linesToParagraphs(lines));
      page.cleanup();
    }
    pdf.destroy && pdf.destroy();

    if (totalText === 0) {
      throw new Error('No text was found. This PDF is probably scanned images. Run it through OCR PDF first to add searchable text, then try again.');
    }

    progress(94, 'Building Word file...');
    var zip = new JSZip();
    zip.file('[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>');
    zip.file('_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>');
    zip.file('word/document.xml', buildDocumentXml(pages));

    var docx = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    progress(100, 'Done');

    return {
      blob: docx,
      filename: baseName(file.name) + '.docx',
      ext: '.docx',
      summary: totalText + ' lines of text'
    };
  }

  /* ---------- PDF to PowerPoint (one picture per slide) ---------- */

  var PPTX_NS = {
    a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
    r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    p: 'http://schemas.openxmlformats.org/presentationml/2006/main'
  };
  var PPTX_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  var PPTX_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';

  function pptxRels(list) {
    return PPTX_XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      list.map(function (r) {
        return '<Relationship Id="' + r.id + '" Type="' + r.type + '" Target="' + r.target + '"/>';
      }).join('') + '</Relationships>';
  }

  // pages: [{ bytes: Uint8Array (JPEG), x, y, w, h }] in EMU. Returns [path, content] pairs.
  function buildPptxParts(pages, slideW, slideH) {
    var parts = [];
    var n = pages.length;
    var NSDECL = ' xmlns:a="' + PPTX_NS.a + '" xmlns:r="' + PPTX_NS.r + '" xmlns:p="' + PPTX_NS.p + '"';

    var overrides = [
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Default Extension="jpeg" ContentType="image/jpeg"/>',
      '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
      '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>',
      '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>',
      '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
    ];
    for (var i = 0; i < n; i++) {
      overrides.push('<Override PartName="/ppt/slides/slide' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>');
    }
    parts.push(['[Content_Types].xml', PPTX_XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' + overrides.join('') + '</Types>']);

    parts.push(['_rels/.rels', pptxRels([{ id: 'rId1', type: PPTX_REL + 'officeDocument', target: 'ppt/presentation.xml' }])]);

    var sldIds = '';
    var presRels = [
      { id: 'rId1', type: PPTX_REL + 'slideMaster', target: 'slideMasters/slideMaster1.xml' },
      { id: 'rId2', type: PPTX_REL + 'theme', target: 'theme/theme1.xml' }
    ];
    for (var s = 0; s < n; s++) {
      sldIds += '<p:sldId id="' + (256 + s) + '" r:id="rId' + (3 + s) + '"/>';
      presRels.push({ id: 'rId' + (3 + s), type: PPTX_REL + 'slide', target: 'slides/slide' + (s + 1) + '.xml' });
    }
    parts.push(['ppt/presentation.xml',
      PPTX_XML + '<p:presentation' + NSDECL + '>' +
      '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
      '<p:sldIdLst>' + sldIds + '</p:sldIdLst>' +
      '<p:sldSz cx="' + slideW + '" cy="' + slideH + '"/>' +
      '<p:notesSz cx="6858000" cy="9144000"/></p:presentation>']);
    parts.push(['ppt/_rels/presentation.xml.rels', pptxRels(presRels)]);

    var emptyTree = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
      '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

    parts.push(['ppt/slideMasters/slideMaster1.xml',
      PPTX_XML + '<p:sldMaster' + NSDECL + '><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>' +
      '<p:spTree>' + emptyTree + '</p:spTree></p:cSld>' +
      '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
      '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>']);
    parts.push(['ppt/slideMasters/_rels/slideMaster1.xml.rels', pptxRels([
      { id: 'rId1', type: PPTX_REL + 'slideLayout', target: '../slideLayouts/slideLayout1.xml' },
      { id: 'rId2', type: PPTX_REL + 'theme', target: '../theme/theme1.xml' }
    ])]);

    parts.push(['ppt/slideLayouts/slideLayout1.xml',
      PPTX_XML + '<p:sldLayout' + NSDECL + ' type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>' + emptyTree +
      '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>']);
    parts.push(['ppt/slideLayouts/_rels/slideLayout1.xml.rels', pptxRels([
      { id: 'rId1', type: PPTX_REL + 'slideMaster', target: '../slideMasters/slideMaster1.xml' }
    ])]);

    parts.push(['ppt/theme/theme1.xml', PPTX_XML +
      '<a:theme xmlns:a="' + PPTX_NS.a + '" name="Office Theme"><a:themeElements>' +
      '<a:clrScheme name="Office">' +
      '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>' +
      '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
      '<a:dk2><a:srgbClr val="1F2937"/></a:dk2><a:lt2><a:srgbClr val="F3F4F6"/></a:lt2>' +
      '<a:accent1><a:srgbClr val="059669"/></a:accent1><a:accent2><a:srgbClr val="0284C7"/></a:accent2>' +
      '<a:accent3><a:srgbClr val="7C3AED"/></a:accent3><a:accent4><a:srgbClr val="F59E0B"/></a:accent4>' +
      '<a:accent5><a:srgbClr val="DC2626"/></a:accent5><a:accent6><a:srgbClr val="64748B"/></a:accent6>' +
      '<a:hlink><a:srgbClr val="0284C7"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink>' +
      '</a:clrScheme>' +
      '<a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
      '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
      '<a:fmtScheme name="Office">' +
      '<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>' +
      '<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>' +
      '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
      '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>' +
      '</a:fmtScheme></a:themeElements></a:theme>']);

    for (var k = 0; k < n; k++) {
      var pg = pages[k];
      var num = k + 1;
      parts.push(['ppt/slides/slide' + num + '.xml',
        PPTX_XML + '<p:sld' + NSDECL + '><p:cSld><p:spTree>' + emptyTree +
        '<p:pic><p:nvPicPr><p:cNvPr id="2" name="Page ' + num + '"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>' +
        '<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>' +
        '<p:spPr><a:xfrm><a:off x="' + pg.x + '" y="' + pg.y + '"/><a:ext cx="' + pg.w + '" cy="' + pg.h + '"/></a:xfrm>' +
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>' +
        '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>']);
      parts.push(['ppt/slides/_rels/slide' + num + '.xml.rels', pptxRels([
        { id: 'rId1', type: PPTX_REL + 'slideLayout', target: '../slideLayouts/slideLayout1.xml' },
        { id: 'rId2', type: PPTX_REL + 'image', target: '../media/image' + num + '.jpeg' }
      ])]);
      parts.push(['ppt/media/image' + num + '.jpeg', pg.bytes]);
    }
    return parts;
  }

  async function convertPdfToPptx(files, progress) {
    requireLib('pdfjsLib', 'PDF');
    requireLib('JSZip', 'ZIP');
    var file = files[0];
    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    progress(5, 'Reading PDF...');
    var pdf;
    try {
      pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    } catch (e) {
      if (e && e.name === 'PasswordException') {
        throw new Error('This PDF is password protected. Unlock it first, then try again.');
      }
      throw new Error('Could not read this PDF. The file may be damaged.');
    }

    var count = pdf.numPages;
    if (count > MAX_PDF_PAGES) {
      throw new Error('This PDF has ' + count + ' pages. The limit is ' + MAX_PDF_PAGES + ' pages per conversion.');
    }

    // Render each page to a JPEG and remember its size in points (1 pt = 1/72 inch).
    var rendered = [];
    for (var p = 1; p <= count; p++) {
      progress(5 + ((p - 1) / count) * 85, 'Rendering page ' + p + ' of ' + count + '...');
      var page = await pdf.getPage(p);
      var base = page.getViewport({ scale: 1 });
      var viewport = page.getViewport({ scale: Math.min(2, 4096 / Math.max(base.width, base.height)) });

      var canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
      var jpeg = await new Promise(function (resolve, reject) {
        canvas.toBlob(function (b) {
          if (b) resolve(b); else reject(new Error('Could not render page ' + p + '.'));
        }, 'image/jpeg', 0.85);
      });
      canvas.width = 0; canvas.height = 0;
      page.cleanup();

      rendered.push({ bytes: new Uint8Array(await jpeg.arrayBuffer()), pw: base.width, ph: base.height });
    }
    pdf.destroy && pdf.destroy();

    // Slide size follows the first page, capped at PowerPoint's 56-inch limit (4032 pt).
    var EMU = 12700;
    var scale = Math.min(1, 4000 / Math.max(rendered[0].pw, rendered[0].ph));
    var slideW = Math.round(rendered[0].pw * scale * EMU);
    var slideH = Math.round(rendered[0].ph * scale * EMU);

    var pages = rendered.map(function (r) {
      var pwE = r.pw * scale * EMU;
      var phE = r.ph * scale * EMU;
      var fit = Math.min(slideW / pwE, slideH / phE);
      var w = Math.round(pwE * fit);
      var h = Math.round(phE * fit);
      return { bytes: r.bytes, x: Math.round((slideW - w) / 2), y: Math.round((slideH - h) / 2), w: w, h: h };
    });

    progress(94, 'Building PowerPoint file...');
    var zip = new JSZip();
    buildPptxParts(pages, slideW, slideH).forEach(function (part) {
      zip.file(part[0], part[1]);
    });
    var pptx = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    });
    progress(100, 'Done');

    return {
      blob: pptx,
      filename: baseName(file.name) + '.pptx',
      ext: '.pptx',
      summary: count + ' slide' + (count === 1 ? '' : 's')
    };
  }

  /* ---------- PDF to Excel (text and simple tables) ---------- */

  var CELL_GAP = 10; // gap in points between text fragments that starts a new cell

  // Group text fragments into rows, then split each row into cells at wide horizontal gaps.
  function textToCellRows(items) {
    var rows = [];
    items.forEach(function (it) {
      if (!it.str) return;
      var row = null;
      for (var r = 0; r < rows.length; r++) {
        if (Math.abs(rows[r].y - it.y) <= 2) { row = rows[r]; break; }
      }
      if (!row) { row = { y: it.y, items: [] }; rows.push(row); }
      row.items.push(it);
    });
    rows.sort(function (a, b) { return b.y - a.y; });

    return rows.map(function (row) {
      row.items.sort(function (a, b) { return a.x - b.x; });
      var cells = [];
      var lastEnd = null;
      row.items.forEach(function (it) {
        if (lastEnd === null || it.x - lastEnd > CELL_GAP) {
          cells.push(it.str);
        } else {
          var gap = it.x - lastEnd;
          cells[cells.length - 1] += (gap > 1.5 ? ' ' : '') + it.str;
        }
        lastEnd = it.x + (it.width || 0);
      });
      return { y: row.y, cells: cells.map(function (c) { return c.replace(/\s+/g, ' ').trim(); }) };
    }).filter(function (r) {
      return r.cells.some(function (c) { return c; });
    });
  }

  // Numbers such as 1200.5, -30 or 1,200 become numbers. Codes such as 007 stay text.
  function toExcelCell(v) {
    if (v === '') return '';
    var clean = v;
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(v)) clean = v.replace(/,/g, '');
    if (/^-?\d+(\.\d+)?$/.test(clean) && !/^-?0\d/.test(clean) && clean.replace(/\D/g, '').length <= 15) {
      return Number(clean);
    }
    return v;
  }

  async function convertPdfExcel(files, progress) {
    requireLib('pdfjsLib', 'PDF');
    requireLib('XLSX', 'spreadsheet');
    var file = files[0];
    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    progress(5, 'Reading PDF...');
    var pdf;
    try {
      pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    } catch (e) {
      if (e && e.name === 'PasswordException') {
        throw new Error('This PDF is password protected. Unlock it first, then try again.');
      }
      throw new Error('Could not read this PDF. The file may be damaged.');
    }

    var count = pdf.numPages;
    if (count > MAX_PDF_PAGES) {
      throw new Error('This PDF has ' + count + ' pages. The limit is ' + MAX_PDF_PAGES + ' pages per conversion.');
    }

    // All pages go on one sheet, with a blank row between pages.
    var rows = [];
    var textRows = 0;
    for (var p = 1; p <= count; p++) {
      progress(5 + ((p - 1) / count) * 85, 'Reading page ' + p + ' of ' + count + '...');
      var page = await pdf.getPage(p);
      var content = await page.getTextContent();
      var items = content.items.map(function (i) {
        return { str: i.str, x: i.transform[4], y: i.transform[5], width: i.width };
      });
      var pageRows = textToCellRows(items);
      if (p > 1 && rows.length && pageRows.length) rows.push([]);
      pageRows.forEach(function (r) {
        rows.push(r.cells.map(toExcelCell));
        textRows++;
      });
      page.cleanup();
    }
    pdf.destroy && pdf.destroy();

    if (textRows === 0) {
      throw new Error('No text was found. This PDF is probably scanned images. Run it through OCR PDF first to add searchable text, then try again.');
    }
    if (rows.length > MAX_SHEET_ROWS) {
      throw new Error('This PDF produces ' + rows.length.toLocaleString() + ' rows. Excel allows up to 1,048,576.');
    }

    progress(94, 'Building Excel file...');
    var ws = XLSX.utils.aoa_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PDF data');
    var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    progress(100, 'Done');

    return {
      blob: new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      filename: baseName(file.name) + '.xlsx',
      ext: '.xlsx',
      summary: textRows.toLocaleString() + ' rows'
    };
  }

  /* ---------- Shared helpers for the newer tools ---------- */

  function isPdfFile(f) {
    return extOf(f.name) === 'pdf' || f.type === 'application/pdf';
  }

  function MODES_IMAGE_VALID(f) {
    var ext = extOf(f.name);
    return ['png', 'jpg', 'jpeg', 'webp', 'avif'].indexOf(ext) !== -1 || /^image\/(png|jpeg|webp|avif)$/.test(f.type);
  }

  function optVal(id) {
    var e = document.getElementById(id);
    return e ? e.value : '';
  }

  // Turns "1-3, 5" into [1, 2, 3, 5]. An empty spec means every page, in order.
  function expandPages(spec, count) {
    var out = [];
    parsePageSpec(spec, count).forEach(function (r) {
      for (var q = r[0]; q <= r[1]; q++) out.push(q);
    });
    return out;
  }

  function parseWholeNumber(text, label, min, max) {
    var n = parseInt(String(text).trim(), 10);
    if (isNaN(n) || n < min || n > max) {
      throw new Error(label + ' must be a whole number from ' + min + ' to ' + max + '.');
    }
    return n;
  }

  async function openPdfLib(file) {
    try {
      return await PDFLib.PDFDocument.load(new Uint8Array(await file.arrayBuffer()));
    } catch (e) {
      throw new Error('Could not read this PDF. It may be password protected or damaged.');
    }
  }

  async function openPdfJs(file) {
    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    try {
      return await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    } catch (e) {
      if (e && e.name === 'PasswordException') {
        throw new Error('This PDF is password protected. Unlock it first, then try again.');
      }
      throw new Error('Could not read this PDF. The file may be damaged.');
    }
  }

  function saveFileName(file, suffix) {
    return baseName(file.name) + '-' + suffix + '.pdf';
  }

  /* ---------- Rotate, crop, number, watermark, organize, sign ---------- */

  async function convertRotate(files, progress) {
    requireLib('PDFLib', 'PDF');
    var doc = await openPdfLib(files[0]);
    var count = doc.getPageCount();
    var angle = parseInt(optVal('rot-angle'), 10);
    var pages = expandPages(optVal('rot-pages'), count);
    var chosen = {};
    pages.forEach(function (p) { chosen[p] = true; });

    progress(30, 'Rotating pages...');
    for (var i = 1; i <= count; i++) {
      if (!chosen[i]) continue;
      var page = doc.getPage(i - 1);
      page.setRotation(PDFLib.degrees((page.getRotation().angle + angle) % 360));
    }
    progress(90, 'Saving PDF...');
    var bytes = await doc.save();
    progress(100, 'Done');
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      filename: saveFileName(files[0], 'rotated'),
      ext: '.pdf',
      summary: pages.length + ' page' + (pages.length === 1 ? '' : 's') + ' rotated'
    };
  }

  async function convertCrop(files, progress) {
    requireLib('PDFLib', 'PDF');
    var doc = await openPdfLib(files[0]);
    var margin = parseWholeNumber(optVal('crop-margin') || '0', 'Margin', 0, 1000);

    progress(30, 'Cropping pages...');
    doc.getPages().forEach(function (page) {
      var box = page.getMediaBox();
      if (2 * margin >= Math.min(box.width, box.height)) {
        throw new Error('The margin is too large for at least one page.');
      }
      var cropped = {
        x: box.x + margin,
        y: box.y + margin,
        width: box.width - 2 * margin,
        height: box.height - 2 * margin
      };
      page.setMediaBox(cropped.x, cropped.y, cropped.width, cropped.height);
      page.setCropBox(cropped.x, cropped.y, cropped.width, cropped.height);
    });

    progress(90, 'Saving PDF...');
    var bytes = await doc.save();
    progress(100, 'Done');
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      filename: saveFileName(files[0], 'cropped'),
      ext: '.pdf',
      summary: margin + ' points trimmed from each edge'
    };
  }

  async function convertPageNumbers(files, progress) {
    requireLib('PDFLib', 'PDF');
    var doc = await openPdfLib(files[0]);
    var start = parseWholeNumber(optVal('pn-start') || '1', 'Start number', 0, 100000);
    var position = optVal('pn-position') || 'bottom-center';
    var font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    var size = 10;
    var margin = 28;

    progress(30, 'Adding numbers...');
    doc.getPages().forEach(function (page, i) {
      var s = page.getSize();
      var text = String(start + i);
      var tw = font.widthOfTextAtSize(text, size);
      var x = /right/.test(position) ? s.width - tw - margin : /left/.test(position) ? margin : (s.width - tw) / 2;
      var y = /top/.test(position) ? s.height - margin - size : margin;
      page.drawText(text, { x: x, y: y, size: size, font: font, color: PDFLib.rgb(0.25, 0.25, 0.25) });
    });

    progress(90, 'Saving PDF...');
    var bytes = await doc.save();
    progress(100, 'Done');
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      filename: saveFileName(files[0], 'numbered'),
      ext: '.pdf',
      summary: doc.getPageCount() + ' pages numbered'
    };
  }

  async function convertWatermark(files, progress) {
    requireLib('PDFLib', 'PDF');
    var text = optVal('wm-text').trim();
    if (!text) throw new Error('Enter the watermark text.');
    if (!/^[\x20-\x7E]+$/.test(text)) {
      throw new Error('Use English letters, numbers and common symbols for the watermark.');
    }
    var doc = await openPdfLib(files[0]);
    var font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    var angle = Math.PI / 4;
    var width1 = font.widthOfTextAtSize(text, 1);

    progress(30, 'Stamping pages...');
    doc.getPages().forEach(function (page) {
      var s = page.getSize();
      var size = Math.min(72, (Math.min(s.width, s.height) * 0.8) / width1);
      var textWidth = width1 * size;
      var x = s.width / 2 - (textWidth / 2) * Math.cos(angle);
      var y = s.height / 2 - (textWidth / 2) * Math.sin(angle) - size * 0.3;
      page.drawText(text, {
        x: x, y: y, size: size, font: font, rotate: PDFLib.degrees(45),
        color: PDFLib.rgb(0.55, 0.55, 0.55), opacity: 0.25
      });
    });

    progress(90, 'Saving PDF...');
    var bytes = await doc.save();
    progress(100, 'Done');
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      filename: saveFileName(files[0], 'watermarked'),
      ext: '.pdf',
      summary: 'watermark on ' + doc.getPageCount() + ' pages'
    };
  }

  async function convertOrganize(files, progress) {
    requireLib('PDFLib', 'PDF');
    var doc = await openPdfLib(files[0]);
    var count = doc.getPageCount();
    var order = expandPages(optVal('org-order'), count);
    var removeSpec = optVal('org-remove').trim();
    var removed = {};
    if (removeSpec) expandPages(removeSpec, count).forEach(function (p) { removed[p] = true; });
    var keep = order.filter(function (p) { return !removed[p]; });
    if (!keep.length) throw new Error('No pages would be left. Change the page lists.');

    progress(30, 'Arranging pages...');
    var out = await PDFLib.PDFDocument.create();
    var copied = await out.copyPages(doc, keep.map(function (p) { return p - 1; }));
    copied.forEach(function (pg) { out.addPage(pg); });

    progress(90, 'Saving PDF...');
    var bytes = await out.save();
    progress(100, 'Done');
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      filename: saveFileName(files[0], 'organized'),
      ext: '.pdf',
      summary: keep.length + ' pages'
    };
  }

  async function convertSign(files, progress) {
    requireLib('PDFLib', 'PDF');
    var name = optVal('sign-text').trim();
    if (!name) throw new Error('Enter your name for the signature.');
    if (!/^[\x20-\x7E]+$/.test(name)) throw new Error('Use English letters for the typed signature.');
    var doc = await openPdfLib(files[0]);
    var count = doc.getPageCount();
    var pageSpec = optVal('sign-page').trim();
    var pageNo = pageSpec ? parseWholeNumber(pageSpec, 'Page', 1, count) : count;
    var position = optVal('sign-position') || 'bottom-right';

    var font = await doc.embedFont(PDFLib.StandardFonts.HelveticaOblique);
    var size = 24;
    var margin = 48;
    var page = doc.getPage(pageNo - 1);
    var s = page.getSize();
    var tw = font.widthOfTextAtSize(name, size);
    var x = /right/.test(position) ? s.width - tw - margin : /left/.test(position) ? margin : (s.width - tw) / 2;
    var y = margin + 16;

    progress(40, 'Adding signature...');
    page.drawText(name, { x: x, y: y, size: size, font: font, color: PDFLib.rgb(0.1, 0.1, 0.35) });
    page.drawLine({
      start: { x: x, y: y - 6 }, end: { x: x + tw, y: y - 6 },
      thickness: 0.8, color: PDFLib.rgb(0.2, 0.2, 0.2)
    });

    progress(90, 'Saving PDF...');
    var bytes = await doc.save();
    progress(100, 'Done');
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      filename: saveFileName(files[0], 'signed'),
      ext: '.pdf',
      summary: 'signed on page ' + pageNo
    };
  }

  /* ---------- Redact (text matched, then pages flattened) ---------- */

  async function convertRedact(files, progress) {
    requireLib('pdfjsLib', 'PDF');
    requireLib('PDFLib', 'PDF');
    var terms = optVal('redact-terms').split(',').map(function (t) { return t.trim().toLowerCase(); }).filter(Boolean);
    if (!terms.length) throw new Error('Enter at least one word or phrase to redact.');

    var pdf = await openPdfJs(files[0]);
    var count = pdf.numPages;
    if (count > MAX_PDF_PAGES) {
      throw new Error('This PDF has ' + count + ' pages. The limit is ' + MAX_PDF_PAGES + ' pages per conversion.');
    }

    var out = await PDFLib.PDFDocument.create();
    var boxes = 0;
    for (var p = 1; p <= count; p++) {
      progress(5 + ((p - 1) / count) * 90, 'Redacting page ' + p + ' of ' + count + '...');
      var page = await pdf.getPage(p);
      var base = page.getViewport({ scale: 1 });
      var viewport = page.getViewport({ scale: Math.min(2, 4096 / Math.max(base.width, base.height)) });
      var content = await page.getTextContent();

      var rects = [];
      content.items.forEach(function (i) {
        if (!i.str) return;
        var s = i.str.toLowerCase();
        var hit = terms.some(function (t) { return s.indexOf(t) !== -1; });
        if (hit) rects.push({ x: i.transform[4], y: i.transform[5] - i.height * 0.2, w: i.width, h: i.height * 1.2 });
      });

      var canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
      var jpeg = await new Promise(function (resolve, reject) {
        canvas.toBlob(function (b) {
          if (b) resolve(b); else reject(new Error('Could not render page ' + p + '.'));
        }, 'image/jpeg', 0.9);
      });
      canvas.width = 0; canvas.height = 0;
      page.cleanup();

      var img = await out.embedJpg(new Uint8Array(await jpeg.arrayBuffer()));
      var pg = out.addPage([base.width, base.height]);
      pg.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
      var view = page.view || [0, 0, base.width, base.height];
      rects.forEach(function (r) {
        pg.drawRectangle({
          x: r.x - view[0], y: r.y - view[1], width: r.w, height: r.h,
          color: PDFLib.rgb(0, 0, 0)
        });
      });
      boxes += rects.length;
    }
    pdf.destroy && pdf.destroy();

    progress(96, 'Saving PDF...');
    var bytes = await out.save();
    progress(100, 'Done');
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      filename: saveFileName(files[0], 'redacted'),
      ext: '.pdf',
      summary: boxes + ' match' + (boxes === 1 ? '' : 'es') + ' redacted'
    };
  }

  /* ---------- PDF to Markdown (text, with headings where clear) ---------- */

  // Group text into rows, keeping the tallest font height in each row.
  function groupRowsWithHeight(items) {
    var rows = [];
    items.forEach(function (it) {
      if (!it.str) return;
      var row = null;
      for (var r = 0; r < rows.length; r++) {
        if (Math.abs(rows[r].y - it.y) <= 2) { row = rows[r]; break; }
      }
      if (!row) { row = { y: it.y, h: 0, items: [] }; rows.push(row); }
      row.items.push(it);
      row.h = Math.max(row.h, it.h || 0);
    });
    rows.sort(function (a, b) { return b.y - a.y; });
    return rows.map(function (row) {
      row.items.sort(function (a, b) { return a.x - b.x; });
      var text = '';
      var lastEnd = null;
      row.items.forEach(function (it) {
        if (lastEnd !== null && it.x - lastEnd > 2 && text && !/\s$/.test(text) && !/^\s/.test(it.str)) text += ' ';
        text += it.str;
        lastEnd = it.x + (it.width || 0);
      });
      return { y: row.y, h: row.h, text: text.replace(/\s+/g, ' ').trim() };
    }).filter(function (r) { return r.text; });
  }

  async function convertPdfMarkdown(files, progress) {
    requireLib('pdfjsLib', 'PDF');
    var pdf = await openPdfJs(files[0]);
    var count = pdf.numPages;
    if (count > MAX_PDF_PAGES) {
      throw new Error('This PDF has ' + count + ' pages. The limit is ' + MAX_PDF_PAGES + ' pages per conversion.');
    }

    var pageRows = [];
    var heights = [];
    for (var p = 1; p <= count; p++) {
      progress(5 + ((p - 1) / count) * 80, 'Reading page ' + p + ' of ' + count + '...');
      var page = await pdf.getPage(p);
      var content = await page.getTextContent();
      var items = content.items.map(function (i) {
        return { str: i.str, x: i.transform[4], y: i.transform[5], width: i.width, h: i.height };
      });
      var rows = groupRowsWithHeight(items);
      rows.forEach(function (r) { if (r.h > 0) heights.push(r.h); });
      pageRows.push(rows);
      page.cleanup();
    }
    pdf.destroy && pdf.destroy();

    heights.sort(function (a, b) { return a - b; });
    var typical = heights.length ? heights[Math.floor(heights.length / 2)] : 0;
    var totalRows = pageRows.reduce(function (n, rows) { return n + rows.length; }, 0);
    if (!totalRows) {
      throw new Error('No text was found. This PDF is probably scanned images. Run it through OCR PDF first to add searchable text, then try again.');
    }

    progress(92, 'Writing Markdown...');
    var pageTexts = pageRows.map(function (rows) {
      var paragraphs = [];
      var current = null;
      var prevY = null;
      rows.forEach(function (r) {
        var isHeading = typical > 0 && r.h > typical * 1.25 && r.text.length < 120;
        if (isHeading) {
          if (current !== null) { paragraphs.push(current); current = null; }
          paragraphs.push('## ' + r.text);
        } else if (current === null) {
          current = r.text;
        } else {
          var gap = prevY - r.y;
          if (typical > 0 && gap > typical * 1.6) {
            paragraphs.push(current);
            current = r.text;
          } else {
            current += ' ' + r.text;
          }
        }
        prevY = r.y;
      });
      if (current !== null) paragraphs.push(current);
      return paragraphs.join('\n\n');
    });

    var markdown = pageTexts.filter(Boolean).join('\n\n---\n\n');
    progress(100, 'Done');
    return {
      blob: new Blob([markdown], { type: 'text/markdown' }),
      filename: baseName(files[0].name) + '.md',
      ext: '.md',
      summary: count + ' page' + (count === 1 ? '' : 's')
    };
  }

  /* ---------- Edit, compare, repair, HTML, OCR and forms ---------- */

  var scriptCache = {};
  function loadScript(url) {
    if (!scriptCache[url]) {
      scriptCache[url] = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = url;
        s.onload = resolve;
        s.onerror = function () {
          scriptCache[url] = null;
          reject(new Error('A converter library did not load. Check your connection and try again.'));
        };
        document.head.appendChild(s);
      });
    }
    return scriptCache[url];
  }

  function renderPageToCanvas(pdf, pageNo, scale) {
    return pdf.getPage(pageNo).then(function (page) {
      var viewport = page.getViewport({ scale: scale });
      var canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise.then(function () {
        page.cleanup();
        return canvas;
      });
    });
  }

  async function convertEditPdf(files, progress) {
    requireLib('PDFLib', 'PDF');
    var text = optVal('edit-text').replace(/\r/g, '');
    if (!text.trim()) throw new Error('Enter the text to add.');
    if (!/^[\x20-\x7E\n]+$/.test(text)) throw new Error('Use English letters, numbers and common symbols for the text.');

    var doc = await openPdfLib(files[0]);
    var count = doc.getPageCount();
    var pageSpec = optVal('edit-page').trim();
    var pageNo = pageSpec ? parseWholeNumber(pageSpec, 'Page', 1, count) : 1;
    var size = parseWholeNumber(optVal('edit-size') || '14', 'Font size', 6, 96);
    var colours = { black: [0, 0, 0], blue: [0.05, 0.25, 0.7], red: [0.8, 0.1, 0.1] };
    var c = colours[optVal('edit-color')] || colours.black;
    var pos = (optVal('edit-position') || 'bottom-center').split('-');
    var vertical = pos[0];
    var horizontal = pos[1];

    var font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    var lines = text.split('\n');
    var lineHeight = size * 1.3;
    var blockHeight = lines.length * lineHeight;
    var widest = lines.reduce(function (m, l) { return Math.max(m, font.widthOfTextAtSize(l, size)); }, 0);
    var page = doc.getPage(pageNo - 1);
    var s = page.getSize();
    var margin = 40;

    var x = horizontal === 'left' ? margin : horizontal === 'right' ? s.width - widest - margin : (s.width - widest) / 2;
    var firstBaseline = vertical === 'top' ? s.height - margin - size
      : vertical === 'bottom' ? margin + blockHeight - lineHeight
      : s.height / 2 + blockHeight / 2 - lineHeight;

    progress(40, 'Adding text...');
    lines.forEach(function (line, i) {
      if (!line) return;
      page.drawText(line, { x: x, y: firstBaseline - i * lineHeight, size: size, font: font, color: PDFLib.rgb(c[0], c[1], c[2]) });
    });

    progress(90, 'Saving PDF...');
    var bytes = await doc.save();
    progress(100, 'Done');
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      filename: saveFileName(files[0], 'edited'),
      ext: '.pdf',
      summary: 'text added to page ' + pageNo
    };
  }

  async function convertComparePdf(files, progress) {
    requireLib('pdfjsLib', 'PDF');
    requireLib('PDFLib', 'PDF');
    if (files.length !== 2) throw new Error('Add exactly two PDFs: the old version first, then the new version.');

    var oldPdf = await openPdfJs(files[0]);
    var newPdf = await openPdfJs(files[1]);
    var newCount = newPdf.numPages;
    if (newCount > MAX_PDF_PAGES) {
      throw new Error('The new PDF has ' + newCount + ' pages. The limit is ' + MAX_PDF_PAGES + ' pages per conversion.');
    }

    var out = await PDFLib.PDFDocument.create();
    var changedPages = 0;
    for (var p = 1; p <= newCount; p++) {
      progress(5 + ((p - 1) / newCount) * 90, 'Comparing page ' + p + ' of ' + newCount + '...');
      var newCanvas = await renderPageToCanvas(newPdf, p, 1.2);
      var sameSize = false;
      var diffPixels = 0;
      if (p <= oldPdf.numPages) {
        var oldCanvas = await renderPageToCanvas(oldPdf, p, 1.2);
        sameSize = oldCanvas.width === newCanvas.width && oldCanvas.height === newCanvas.height;
        if (sameSize) {
          var a = oldCanvas.getContext('2d').getImageData(0, 0, oldCanvas.width, oldCanvas.height).data;
          var ctx = newCanvas.getContext('2d');
          var img = ctx.getImageData(0, 0, newCanvas.width, newCanvas.height);
          var b = img.data;
          for (var k = 0; k < b.length; k += 4) {
            var diff = Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2]);
            if (diff > 60) {
              diffPixels++;
              b[k] = 255;
              b[k + 1] = Math.round(b[k + 1] * 0.35);
              b[k + 2] = Math.round(b[k + 2] * 0.35);
            }
          }
          ctx.putImageData(img, 0, 0);
        }
        oldCanvas.width = 0; oldCanvas.height = 0;
      }
      if (!sameSize || diffPixels > 0) changedPages++;

      var jpeg = await new Promise(function (resolve, reject) {
        newCanvas.toBlob(function (bl) {
          if (bl) resolve(bl); else reject(new Error('Could not build page ' + p + '.'));
        }, 'image/jpeg', 0.9);
      });
      var base = (await newPdf.getPage(p)).getViewport({ scale: 1 });
      var embedded = await out.embedJpg(new Uint8Array(await jpeg.arrayBuffer()));
      var pg = out.addPage([base.width, base.height]);
      pg.drawImage(embedded, { x: 0, y: 0, width: base.width, height: base.height });
      newCanvas.width = 0; newCanvas.height = 0;
    }
    oldPdf.destroy && oldPdf.destroy();
    newPdf.destroy && newPdf.destroy();

    progress(96, 'Saving PDF...');
    var bytes = await out.save();
    progress(100, 'Done');
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      filename: saveFileName(files[1], 'compared'),
      ext: '.pdf',
      summary: changedPages + ' of ' + newCount + ' pages changed (in red)'
    };
  }

  async function convertRepairPdf(files, progress) {
    requireLib('PDFLib', 'PDF');
    var bytes = new Uint8Array(await files[0].arrayBuffer());
    progress(30, 'Rebuilding the file structure...');
    try {
      var doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false });
      if (doc.getPageCount() === 0) throw new Error('no pages');
      var rebuilt = await doc.save();
      progress(100, 'Done');
      return {
        blob: new Blob([rebuilt], { type: 'application/pdf' }),
        filename: saveFileName(files[0], 'repaired'),
        ext: '.pdf',
        summary: 'file structure rebuilt'
      };
    } catch (e) {
      // Fall back to redrawing each page as an image.
      progress(40, 'Rebuilding pages as images...');
      var pdf;
      try {
        pdf = await openPdfJs(files[0]);
      } catch (err) {
        throw new Error('This file is too damaged to repair.');
      }
      var out = await PDFLib.PDFDocument.create();
      for (var p = 1; p <= pdf.numPages; p++) {
        progress(40 + ((p - 1) / pdf.numPages) * 55, 'Rebuilding page ' + p + ' of ' + pdf.numPages + '...');
        var canvas = await renderPageToCanvas(pdf, p, 1.5);
        var jpeg = await new Promise(function (resolve, reject) {
          canvas.toBlob(function (bl) {
            if (bl) resolve(bl); else reject(new Error('Could not rebuild page ' + p + '.'));
          }, 'image/jpeg', 0.9);
        });
        var base = (await pdf.getPage(p)).getViewport({ scale: 1 });
        var img = await out.embedJpg(new Uint8Array(await jpeg.arrayBuffer()));
        var pg = out.addPage([base.width, base.height]);
        pg.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
        canvas.width = 0; canvas.height = 0;
      }
      pdf.destroy && pdf.destroy();
      progress(98, 'Saving PDF...');
      var outBytes = await out.save();
      progress(100, 'Done');
      return {
        blob: new Blob([outBytes], { type: 'application/pdf' }),
        filename: saveFileName(files[0], 'repaired'),
        ext: '.pdf',
        summary: 'rebuilt as images, so text is not selectable'
      };
    }
  }

  async function convertHtmlPdf(files, progress) {
    requireLib('PDFLib', 'PDF');
    var source = optVal('html-source').trim();
    if (!source) throw new Error('Paste some HTML to convert.');

    progress(10, 'Loading renderer...');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    requireLib('html2canvas', 'HTML renderer');

    // Keep the content, but drop anything that can run or load other pages.
    var parsed = new DOMParser().parseFromString(source, 'text/html');
    parsed.querySelectorAll('script, iframe, object, embed, link, meta, style, base').forEach(function (n) { n.remove(); });
    parsed.body.querySelectorAll('*').forEach(function (el) {
      Array.prototype.slice.call(el.attributes).forEach(function (a) {
        if (/^on/i.test(a.name) || (/^(href|src|action)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) {
          el.removeAttribute(a.name);
        }
      });
    });

    var container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;padding:40px;box-sizing:border-box;background:#ffffff;color:#111111;font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.5;';
    container.innerHTML = parsed.body.innerHTML;
    document.body.appendChild(container);

    progress(35, 'Rendering HTML...');
    var canvas;
    try {
      canvas = await window.html2canvas(container, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
    } finally {
      container.remove();
    }
    if (!canvas || canvas.height === 0) throw new Error('Nothing was rendered. Check the HTML and try again.');

    progress(70, 'Building pages...');
    var out = await PDFLib.PDFDocument.create();
    var A4_W = 595.28;
    var A4_H = 841.89;
    var sliceH = Math.round(canvas.width * (A4_H / A4_W));
    for (var y = 0; y < canvas.height; y += sliceH) {
      var h = Math.min(sliceH, canvas.height - y);
      var slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = h;
      slice.getContext('2d').drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      var jpeg = await new Promise(function (resolve, reject) {
        slice.toBlob(function (bl) {
          if (bl) resolve(bl); else reject(new Error('Could not build a page.'));
        }, 'image/jpeg', 0.9);
      });
      var img = await out.embedJpg(new Uint8Array(await jpeg.arrayBuffer()));
      var pageHeight = A4_W * (h / canvas.width);
      var pg = out.addPage([A4_W, pageHeight]);
      pg.drawImage(img, { x: 0, y: 0, width: A4_W, height: pageHeight });
    }

    progress(96, 'Saving PDF...');
    var bytes = await out.save();
    progress(100, 'Done');
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      filename: 'converted-html.pdf',
      ext: '.pdf',
      summary: out.getPageCount() + ' page' + (out.getPageCount() === 1 ? '' : 's')
    };
  }

  async function convertOcrPdf(files, progress) {
    requireLib('PDFLib', 'PDF');
    requireLib('pdfjsLib', 'PDF');
    progress(3, 'Loading text recognition...');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.4/tesseract.min.js');
    requireLib('Tesseract', 'text recognition');

    var pdf = await openPdfJs(files[0]);
    var count = pdf.numPages;
    if (count > 60) {
      throw new Error('This PDF has ' + count + ' pages. OCR is limited to 60 pages per conversion.');
    }

    var worker = await Tesseract.createWorker('eng', 1, {
      langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int'
    });
    var out = await PDFLib.PDFDocument.create();
    var font = await out.embedFont(PDFLib.StandardFonts.Helvetica);
    var wordCount = 0;
    try {
      for (var p = 1; p <= count; p++) {
        progress(5 + ((p - 1) / count) * 90, 'Reading page ' + p + ' of ' + count + '...');
        var page = await pdf.getPage(p);
        var base = page.getViewport({ scale: 1 });
        var viewport = page.getViewport({ scale: Math.min(2, 4096 / Math.max(base.width, base.height)) });
        var canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
        page.cleanup();

        var result = await worker.recognize(canvas, {}, { blocks: true });
        var words = [];
        (result.data.blocks || []).forEach(function (b) {
          (b.paragraphs || []).forEach(function (pa) {
            (pa.lines || []).forEach(function (l) {
              (l.words || []).forEach(function (w) { words.push(w); });
            });
          });
        });

        var jpeg = await new Promise(function (resolve, reject) {
          canvas.toBlob(function (bl) {
            if (bl) resolve(bl); else reject(new Error('Could not build page ' + p + '.'));
          }, 'image/jpeg', 0.9);
        });
        var img = await out.embedJpg(new Uint8Array(await jpeg.arrayBuffer()));
        var pg = out.addPage([base.width, base.height]);
        pg.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });

        // Add the recognised words as invisible text, so the page can be searched and selected.
        var k = base.width / canvas.width;
        words.forEach(function (w) {
          var t = (w.text || '').trim();
          if (!t || !/^[\x20-\x7E]+$/.test(t) || !w.bbox) return;
          var boxH = (w.bbox.y1 - w.bbox.y0) * k;
          var size = Math.max(4, boxH * 0.9);
          pg.drawText(t, { x: w.bbox.x0 * k, y: base.height - w.bbox.y1 * k, size: size, font: font, opacity: 0 });
          wordCount++;
        });
        canvas.width = 0; canvas.height = 0;
      }
    } finally {
      await worker.terminate();
      pdf.destroy && pdf.destroy();
    }

    progress(96, 'Saving PDF...');
    var bytes = await out.save();
    progress(100, 'Done');
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      filename: saveFileName(files[0], 'ocr'),
      ext: '.pdf',
      summary: wordCount + ' words recognised'
    };
  }

  async function convertFormsPdf(files, progress) {
    requireLib('PDFLib', 'PDF');
    var lines = optVal('form-fields').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) throw new Error('Enter at least one field name.');

    var doc = await openPdfLib(files[0]);
    var count = doc.getPageCount();
    var pageSpec = optVal('form-page').trim();
    var pageNo = pageSpec ? parseWholeNumber(pageSpec, 'Page', 1, count) : 1;
    var page = doc.getPage(pageNo - 1);
    var s = page.getSize();
    var form = doc.getForm();
    var used = {};
    var y = s.height - 120;

    progress(40, 'Adding fields...');
    lines.forEach(function (line, i) {
      var isCheckbox = /\[checkbox\]\s*$/i.test(line);
      var label = line.replace(/\[checkbox\]\s*$/i, '').trim() || 'Field ' + (i + 1);
      var name = label;
      var n = 2;
      while (used[name]) name = label + ' ' + n++;
      used[name] = true;

      if (isCheckbox) {
        var box = form.createCheckBox(name);
        box.addToPage(page, { x: 72, y: y, width: 14, height: 14 });
      } else {
        var field = form.createTextField(name);
        field.addToPage(page, { x: 72, y: y, width: 260, height: 20, borderWidth: 1, borderColor: PDFLib.rgb(0.6, 0.6, 0.6) });
      }
      y -= 40;
    });

    progress(90, 'Saving PDF...');
    var bytes = await doc.save();
    progress(100, 'Done');
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      filename: saveFileName(files[0], 'forms'),
      ext: '.pdf',
      summary: lines.length + ' field' + (lines.length === 1 ? '' : 's') + ' added'
    };
  }

  /* ---------- Run ---------- */

  async function runConvert() {
    if (state.busy) return;
    if (!state.files.length && !MODES[state.mode].noFile) {
      setStatus('Add a file first.', 'error');
      return;
    }
    clearResult();
    setBusy(true);
    setStatus('', '');
    setProgress(0, 'Starting...');
    try {
      var result = await MODES[state.mode].convert(state.files.slice(), setProgress);
      state.result = { blob: result.blob, filename: result.filename, ext: result.ext };
      el.download.disabled = false;
      el.download.textContent = 'Download ' + result.ext;
      setStatus('Done. ' + result.filename + ' is ready (' + formatSize(result.blob.size) + ', ' + result.summary + ').', 'ok');
    } catch (err) {
      setStatus(err && err.message ? err.message : 'Something went wrong during conversion.', 'error');
    } finally {
      setBusy(false);
      hideProgress();
      renderQueue();
    }
  }

  function runDownload() {
    if (!state.result) return;
    saveBlob(state.result.blob, state.result.filename);
  }

  /* ---------- Events ---------- */

  el.input.addEventListener('change', function (e) {
    addFiles(e.target.files);
    e.target.value = '';
  });

  el.dropzone.addEventListener('click', function () { if (!state.busy) el.input.click(); });
  el.dropzone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!state.busy) el.input.click();
    }
  });
  el.dropzone.addEventListener('dragover', function (e) { e.preventDefault(); el.dropzone.classList.add('over'); });
  el.dropzone.addEventListener('dragleave', function () { el.dropzone.classList.remove('over'); });
  el.dropzone.addEventListener('drop', function (e) {
    e.preventDefault();
    el.dropzone.classList.remove('over');
    addFiles(e.dataTransfer && e.dataTransfer.files);
  });

  // Stop a stray drop outside the dropzone from navigating away from the page.
  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) { e.preventDefault(); });

  el.convert.addEventListener('click', runConvert);
  el.reset.addEventListener('click', resetAll);
  el.download.addEventListener('click', runDownload);

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      if (!state.busy) el.input.click();
    } else if (e.key === 'Enter' && document.activeElement === document.body) {
      e.preventDefault();
      runConvert();
    }
  });

  // Ads: request each slot once the page is ready.
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('ins.adsbygoogle').forEach(function () {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* ad blocked or unavailable */ }
    });
  });

  renderHeader();
  renderQueue();
})();
