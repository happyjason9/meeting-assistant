chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "save_record") {

        const now = new Date();
        // 格式化時間檔名
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const folderName = "Meeting_Records";

        // 下載錄音檔
        chrome.downloads.download({
            url: request.audioData,
            filename: `${folderName}/audio_${timestamp}.webm`,
            saveAs: false
        });

        // 下載文字檔
        chrome.downloads.download({
            url: request.textData,
            filename: `${folderName}/text_${timestamp}.txt`,
            saveAs: false
        });
    }
});