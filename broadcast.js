const { chromium } = require('playwright');
const { spawn } = require('child_process');

(async () => {
    // GitHub YAML inputs se data lena
    const url = process.env.TARGET_URL;
    const streamKey = process.env.FB_STREAM_KEY;
    const durationMinutes = parseInt(process.env.DURATION || '30');

    if (!url || !streamKey) {
        console.error("URL ya Facebook Stream Key missing hai!");
        process.exit(1);
    }

    // Xvfb environment mein headless false hona zaroori hai
    const browser = await chromium.launch({ 
        headless: false,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--window-size=1280,720',
            '--autoplay-policy=no-user-gesture-required'
        ] 
    });
    
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    console.log(`[+] Website open ho rahi hai: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log("[+] Facebook Live stream start ho rahi hai...");

    // FFmpeg ka code jo browser ki screen capture karke Facebook ko bhejega
    const rtmpUrl = `rtmps://live-api-s.facebook.com:443/rtmp/${streamKey}`;
    
    const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-f', 'x11grab',                 // Screen capture
        '-video_size', '1280x720',       // Resolution
        '-framerate', '30',              // FPS
        '-i', process.env.DISPLAY || ':99', // Xvfb Display ID
        '-c:v', 'libx264',               // Video Codec
        '-preset', 'veryfast',           // CPU usage preset
        '-b:v', '2500k',                 // Video Bitrate
        '-maxrate', '2500k',
        '-bufsize', '5000k',
        '-pix_fmt', 'yuv420p',
        '-g', '60',                      // Keyframe interval (zaroori for FB)
        '-f', 'flv',                     // Format (RTMP ke liye)
        rtmpUrl
    ]);

    ffmpeg.stderr.on('data', (data) => {
        // Agar error/logs dekhne hon toh isko uncomment kar dein
        // console.log(`FFmpeg: ${data}`); 
    });

    console.log(`[+] Stream chalu hai! Yeh script ${durationMinutes} minutes tak chalegi...`);
    
    // Stream ko required time tak chalne dein
    await page.waitForTimeout(durationMinutes * 60 * 1000);

    console.log("[+] Script mukammal ho gaya. Browser band ho raha hai...");
    ffmpeg.kill('SIGINT');
    await browser.close();
})();
