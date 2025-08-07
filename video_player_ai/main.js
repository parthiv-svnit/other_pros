const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow;

const cleanupTempFiles = () => {
    const tempDir = os.tmpdir();
    fs.readdir(tempDir, (err, files) => {
        if (err) { console.error("Error reading temp dir:", err); return; }
        for (const file of files) {
            if (file.startsWith('mx-player-')) {
                fs.unlink(path.join(tempDir, file), err => {
                    if (err) console.error(`Error deleting temp file ${file}:`, err);
                });
            }
        }
    });
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    autoHideMenuBar: true, 
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');
  
  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send('fullscreen-changed', true);
  });
  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('fullscreen-changed', false);
  });
}

app.whenReady().then(() => {
  cleanupTempFiles();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  cleanupTempFiles();
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('toggle-fullscreen', () => {
    if (mainWindow) {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
});

ipcMain.on('open-file-dialog', (event) => {
  dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Media Files', extensions: ['mkv', 'mp4', 'avi', 'mov'] }]
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      event.sender.send('files-selected', result.filePaths);
    }
  }).catch(err => console.log(err));
});

ipcMain.handle('analyze-file', async (event, filePath) => {
    const command = `ffprobe -v quiet -print_format json -show_streams "${filePath}"`;
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`ffprobe error: ${error}`);
                reject('FFprobe could not analyze the file. Is FFmpeg installed and in your PATH?');
                return;
            }
            resolve({ filePath, info: JSON.parse(stdout) });
        });
    });
});

ipcMain.handle('extract-stream', async (event, { filePath, stream }) => {
    const tempDir = os.tmpdir();
    const uniqueId = `mx-player-${Date.now()}`;
    
    let command;
    let outputPath;

    if (stream.codec_type === 'audio') {
        outputPath = path.join(tempDir, `${uniqueId}_audio_${stream.index}.aac`);
        if (stream.codec_name === 'aac') {
            command = `ffmpeg -y -i "${filePath}" -map 0:${stream.index} -c:a copy "${outputPath}"`;
        } else {
            command = `ffmpeg -y -i "${filePath}" -map 0:${stream.index} -c:a aac "${outputPath}"`;
        }
    } else if (stream.codec_type === 'subtitle') {
        outputPath = path.join(tempDir, `${uniqueId}_sub_${stream.index}.vtt`);
        command = `ffmpeg -y -i "${filePath}" -map 0:${stream.index} -c:s webvtt "${outputPath}"`;
    } else {
        return Promise.reject('Unsupported stream type for extraction.');
    }

    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`FFmpeg exec error: ${stderr}`);
                reject(new Error(`FFmpeg failed to extract stream: ${stderr}`));
            } else {
                if (stream.codec_type === 'subtitle') {
                    try {
                        const vttContent = fs.readFileSync(outputPath, 'utf8');
                        const cleanedContent = vttContent.split('\n').map(line => {
                            if (line.includes('-->') || /^\d+$/.test(line.trim()) || line.trim() === 'WEBVTT' || line.trim() === '') {
                                return line;
                            }
                            return line.replace(/"/g, '');
                        }).join('\n');
                        fs.writeFileSync(outputPath, cleanedContent, 'utf8');
                    } catch (e) {
                        console.error("Failed to clean subtitle file:", e);
                    }
                }
                resolve(outputPath);
            }
        });
    });
});


ipcMain.handle('open-subtitle-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Subtitles', extensions: ['srt', 'vtt', 'ass'] }]
    });
    return result.canceled ? null : result.filePaths[0];
});
