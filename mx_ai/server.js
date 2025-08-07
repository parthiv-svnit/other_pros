const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const port = 3000;

// Enhanced CORS configuration
app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// Static file serving
app.use('/processed', express.static(path.join(__dirname, 'processed')));
app.use(express.static(__dirname));

// Configure FFmpeg path if needed (uncomment if FFmpeg is not in system PATH)
// ffmpeg.setFfmpegPath('/path/to/ffmpeg');

// Create necessary directories if they don't exist
const ensureDirectoryExists = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

ensureDirectoryExists(path.join(__dirname, 'uploads'));
ensureDirectoryExists(path.join(__dirname, 'processed'));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'uploads'));
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'video/mp4', 'video/webm', 'video/ogg', 'video/x-matroska',
            'video/quicktime', 'video/x-msvideo', 'video/x-flv'
        ];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Invalid file type. Only video files are allowed.'));
        }
        cb(null, true);
    },
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB limit
    }
});

const getFilePaths = (filename) => {
    const baseName = path.basename(filename, path.extname(filename));
    const processedDir = path.join(__dirname, 'processed', baseName);
    ensureDirectoryExists(processedDir);
    return {
        baseName,
        processedDir,
        videoPath: path.join(processedDir, 'video.mp4'),
        audioPaths: [],
        subtitlePaths: []
    };
};

const cleanupFiles = (filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        console.error('Error cleaning up file:', err);
    }
};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/upload', upload.single('video'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const inputFile = req.file.path;
    const { baseName, processedDir } = getFilePaths(req.file.filename);

    try {
        // 1. Get video metadata
        const metadata = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(inputFile, (err, metadata) => {
                if (err) return reject(err);
                resolve(metadata);
            });
        });

        if (!metadata.streams || metadata.streams.length === 0) {
            throw new Error('No streams found in the video file');
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStreams = metadata.streams.filter(s => s.codec_type === 'audio');
        const subtitleStreams = metadata.streams.filter(s => s.codec_type === 'subtitle');

        console.log(`Processing: ${req.file.originalname}`);
        console.log(`Video streams: ${videoStream ? 1 : 0}`);
        console.log(`Audio streams: ${audioStreams.length}`);
        console.log(`Subtitle streams: ${subtitleStreams.length}`);

        // 2. Process Video Stream
        await new Promise((resolve, reject) => {
            const command = ffmpeg(inputFile)
                .output(path.join(processedDir, 'video.mp4'))
                .noAudio()
                .videoCodec('copy')
                .on('start', (commandLine) => {
                    console.log('Spawned FFmpeg with command: ' + commandLine);
                })
                .on('progress', (progress) => {
                    console.log(`Processing: ${progress.timemark}`);
                })
                .on('end', () => {
                    console.log('Video processing finished');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('Video processing error:', err);
                    reject(err);
                });

            if (videoStream && videoStream.codec_name === 'h264') {
                command.addOutputOption('-c:v libx264');
            }

            command.run();
        });

        // 3. Process Audio Streams
        const audioTracks = await Promise.all(audioStreams.map(async (stream, i) => {
            const outputAudioPath = path.join(processedDir, `audio_${i}.aac`);
            await new Promise((resolve, reject) => {
                ffmpeg(inputFile)
                    .output(outputAudioPath)
                    .noVideo()
                    .audioCodec('aac')
                    .addOutputOption(`-map 0:${stream.index}`)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });
            return {
                url: `/processed/${baseName}/audio_${i}.aac`,
                label: stream.tags?.title || stream.tags?.language || `Audio ${i + 1}`
            };
        }));

        // 4. Process Subtitle Streams
        const subtitleTracks = await Promise.all(subtitleStreams.map(async (stream, i) => {
            const outputSubtitlePath = path.join(processedDir, `sub_${i}.vtt`);
            await new Promise((resolve, reject) => {
                ffmpeg(inputFile)
                    .output(outputSubtitlePath)
                    .addOutputOption(`-map 0:${stream.index}`)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });
            return {
                url: `/processed/${baseName}/sub_${i}.vtt`,
                label: stream.tags?.title || stream.tags?.language || `Subtitle ${i + 1}`
            };
        }));

        // Cleanup the uploaded file
        cleanupFiles(inputFile);

        res.json({
            success: true,
            videoUrl: `/processed/${baseName}/video.mp4`,
            audioTracks,
            subtitleTracks,
            filename: req.file.originalname
        });

    } catch (error) {
        console.error('Processing error:', error);
        cleanupFiles(inputFile);
        res.status(500).json({ 
            success: false,
            error: 'Video processing failed',
            details: error.message 
        });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Make sure FFmpeg is installed and available in your system PATH');
});