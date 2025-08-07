import imageio_ffmpeg as ffmpeg
import subprocess

def convert_mts_to_mp4(input_path, output_path):
    # Get auto-downloaded ffmpeg binary
    ffmpeg_path = ffmpeg.get_ffmpeg_exe()
    
    # Command to convert MTS to MP4
    command = [
        ffmpeg_path,
        "-i", input_path,       # Input file
        "-c:v", "libx264",      # Video codec
        "-c:a", "aac",          # Audio codec
        output_path
    ]
    
    subprocess.run(command)

# Example usage
convert_mts_to_mp4("video.mts", "video.mp4")
