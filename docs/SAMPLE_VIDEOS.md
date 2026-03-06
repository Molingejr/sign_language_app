# Sample videos for testing

Use these to try **Upload video** (single sign) and **Sentence (full video)**.  
Supported formats: **MP4, WebM, MPEG (.mpg, .mpeg)**.

---

## Single sign (direct MP4)

- **Book:** http://aslbricks.org/New/ASL-Videos/book.mp4  
  Use with **Interpret as: Single sign**.

---

## Sentence-level (download from YouTube)

These show short ASL phrases/sentences. Download as MP4 then upload with **Interpret as: Sentence (full video)**.

1. **ASL Nice to meet you**  
   https://www.youtube.com/watch?v=S40fTlJY0PQ  

2. **ASL Greetings and polite phrases** (How are you, nice to meet you, etc.)  
   https://www.youtube.com/watch?v=RlTQEv5I_Y0  

**Download with yt-dlp (recommended):**
```bash
# Install: pip install yt-dlp   (or brew install yt-dlp)
yt-dlp -f "best[ext=mp4]" "https://www.youtube.com/watch?v=S40fTlJY0PQ" -o asl_nice_to_meet_you.mp4
```
Then trim to ~10–20 seconds if you want a short sentence clip (e.g. with QuickTime or `ffmpeg`).

**Or:** use a browser extension or site like https://yt1s.com (paste the YouTube URL, download MP4).

---

## How2Sign dataset (sentence-level, research use)

- **Site:** https://how2sign.github.io/  
- **Sample / validation clips:** Use “Download Sample” on the site, or the [Validation RGB clips (1.7G)](https://drive.google.com/file/d/1DhLH8tIBn9HsTzUJUfsEOGcP4l9EvOiO/view?usp=sharing) (Google Drive). Each clip is one sentence.  
- **License:** CC BY-NC (non-commercial). See [How2Sign](https://how2sign.github.io/) for terms.

---

## Quick test without downloading

1. **Single sign:** Use the direct link above (right-click → Save link as `book.mp4`), or record yourself signing one word with the app’s camera.  
2. **Sentence:** Download one of the YouTube links with yt-dlp or a downloader, then upload the MP4 with **Sentence (full video)** selected.
