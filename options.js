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
        errorDiv.style.display = 'block';
    }
});
