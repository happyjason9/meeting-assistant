// 載入已儲存的 API Key
chrome.storage.local.get('translateApiKey', ({ translateApiKey }) => {
    if (translateApiKey) {
        document.getElementById('translate-api-key').value = translateApiKey;
    }
});

document.getElementById('save-api-key-btn').addEventListener('click', () => {
    const key = document.getElementById('translate-api-key').value.trim();
    const successDiv = document.getElementById('api-key-success');
    const errorDiv = document.getElementById('api-key-error');
    successDiv.style.display = 'none';
    errorDiv.style.display = 'none';

    if (!key) {
        errorDiv.innerText = '❌ 請先輸入 API Key。';
        errorDiv.style.display = 'block';
        return;
    }
    chrome.storage.local.set({ translateApiKey: key }, () => {
        successDiv.style.display = 'block';
    });
});

document.getElementById('request-btn').addEventListener('click', async () => {
    const successDiv = document.getElementById('status-success');
    const errorDiv = document.getElementById('status-error');
    
    successDiv.style.display = 'none';
    errorDiv.style.display = 'none';

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // 成功取得權限後立即關閉 stream 釋放硬體資源
        stream.getTracks().forEach(track => track.stop());
        successDiv.style.display = 'block';
    } catch (err) {
        console.error('取得麥克風權限失敗:', err);
        errorDiv.innerText = '❌ 無法取得麥克風權限，請確認系統隱私權設定。錯誤代碼：' + err.name + ' - ' + err.message;
        errorDiv.style.display = 'block';
    }
});
