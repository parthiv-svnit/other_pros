import os
from flask import Flask, request, render_template, send_from_directory, flash, redirect, url_for
from pydub import AudioSegment
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['SECRET_KEY'] = 'a_super_secret_key' # Change this for production
app.config['UPLOAD_FOLDER'] = 'uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        # 1. Check if a file was uploaded
        if 'file' not in request.files:
            flash('No file part')
            return redirect(request.url)

        file = request.files['file']
        if file.filename == '':
            flash('No selected file')
            return redirect(request.url)

        # 2. Get trim times from the form (in seconds)
        try:
            start_time = int(request.form.get('start', 0)) * 1000  # pydub works in milliseconds
            end_time = int(request.form.get('end')) * 1000
        except (ValueError, TypeError):
            flash('Invalid start or end time.')
            return redirect(request.url)

        if file and file.filename.endswith('.mp3'):
            filename = secure_filename(file.filename)
            
            # 3. Process the audio using pydub
            try:
                audio = AudioSegment.from_mp3(file)
                trimmed_audio = audio[start_time:end_time]
                
                # 4. Save the trimmed file
                output_filename = f"trimmed_{filename}"
                output_path = os.path.join(app.config['UPLOAD_FOLDER'], output_filename)
                trimmed_audio.export(output_path, format="mp3")

                # 5. Pass the filename to the template for the download link
                return render_template('index.html', filename=output_filename)

            except Exception as e:
                flash(f"An error occurred during processing: {e}")
                return redirect(request.url)

    return render_template('index.html', filename=None)

@app.route('/uploads/<filename>')
def download_file(filename):
    """Serve the processed file for downloading."""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)