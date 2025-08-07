# app.py
from flask import Flask, render_template, request, redirect, url_for, flash, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import os

# --- App and Database Configuration ---
app = Flask(__name__)
# It's crucial to set a secret key for session management and flashing messages.
# In a production environment, this should be a complex, random string stored securely.
app.config['SECRET_KEY'] = 'a_very_secret_key_that_should_be_changed'
# Set the database URI. This tells SQLAlchemy where to find the database file.
# We are using SQLite, a serverless, file-based database engine.
# The database file 'bank.db' will be created in the instance folder of the app.
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///bank.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize the SQLAlchemy extension
db = SQLAlchemy(app)

# --- Database Models ---
# These classes define the structure of our database tables.

class User(db.Model):
    """User model for storing user credentials and account details."""
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    balance = db.Column(db.Float, nullable=False, default=1000.0) # New users get a starting balance
    transactions = db.relationship('Transaction', backref='user', lazy=True)

    def set_password(self, password):
        """Hashes the password for security."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Checks if the provided password matches the stored hash."""
        return check_password_hash(self.password_hash, password)

class Transaction(db.Model):
    """Transaction model for recording all financial activities."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    type = db.Column(db.String(20), nullable=False) # e.g., 'Deposit', 'Withdrawal', 'Transfer'
    amount = db.Column(db.Float, nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    description = db.Column(db.String(200), nullable=True)

# --- Application Routes ---
# These functions handle requests for different URLs (e.g., '/', '/login').

@app.before_request
def create_tables():
    """Create database tables before the first request."""
    # This ensures that the database and tables are created if they don't exist.
    # In a larger application, you might use Flask-Migrate for this.
    if not os.path.exists(os.path.join(app.instance_path, 'bank.db')):
        with app.app_context():
            db.create_all()
            print("Database created!")


@app.route('/')
def index():
    """Homepage: Redirects to dashboard if logged in, otherwise to login."""
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    """Handles user registration."""
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        # Check if username already exists
        if User.query.filter_by(username=username).first():
            flash('Username already exists. Please choose another one.', 'danger')
            return redirect(url_for('register'))

        # Create new user and save to database
        new_user = User(username=username)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()

        flash('Registration successful! Please log in.', 'success')
        return redirect(url_for('login'))

    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Handles user login."""
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = User.query.filter_by(username=username).first()

        if user and user.check_password(password):
            # Store user id in session to keep them logged in
            session['user_id'] = user.id
            session['username'] = user.username
            flash('Logged in successfully!', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid username or password.', 'danger')

    return render_template('login.html')

@app.route('/dashboard')
def dashboard():
    """Displays the user's dashboard with balance and recent transactions."""
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])
    
    # **FIX**: Add check to ensure user exists. If not, clear session and redirect.
    if not user:
        session.clear()
        flash('User not found. Please log in again.', 'danger')
        return redirect(url_for('login'))

    # Get the 5 most recent transactions
    recent_transactions = Transaction.query.filter_by(user_id=user.id).order_by(Transaction.timestamp.desc()).limit(5).all()
    return render_template('dashboard.html', user=user, transactions=recent_transactions)

@app.route('/deposit', methods=['GET', 'POST'])
def deposit():
    """Handles deposits to the user's account."""
    if 'user_id' not in session:
        return redirect(url_for('login'))

    if request.method == 'POST':
        try:
            amount = float(request.form['amount'])
            if amount <= 0:
                flash('Deposit amount must be positive.', 'warning')
                return redirect(url_for('deposit'))

            user = User.query.get(session['user_id'])
            user.balance += amount

            # Record the transaction
            new_transaction = Transaction(user_id=user.id, type='Deposit', amount=amount, description='Self-deposit')
            db.session.add(new_transaction)
            db.session.commit()

            flash(f'Successfully deposited ${amount:.2f}', 'success')
            return redirect(url_for('dashboard'))
        except ValueError:
            flash('Invalid amount entered.', 'danger')
            return redirect(url_for('deposit'))

    return render_template('deposit.html')

@app.route('/withdraw', methods=['GET', 'POST'])
def withdraw():
    """Handles withdrawals from the user's account."""
    if 'user_id' not in session:
        return redirect(url_for('login'))

    if request.method == 'POST':
        try:
            amount = float(request.form['amount'])
            user = User.query.get(session['user_id'])

            if amount <= 0:
                flash('Withdrawal amount must be positive.', 'warning')
                return redirect(url_for('withdraw'))
            if amount > user.balance:
                flash('Insufficient funds.', 'danger')
                return redirect(url_for('withdraw'))

            user.balance -= amount
            # Record the transaction
            new_transaction = Transaction(user_id=user.id, type='Withdrawal', amount=-amount, description='Self-withdrawal')
            db.session.add(new_transaction)
            db.session.commit()

            flash(f'Successfully withdrew ${amount:.2f}', 'success')
            return redirect(url_for('dashboard'))
        except ValueError:
            flash('Invalid amount entered.', 'danger')
            return redirect(url_for('withdraw'))

    return render_template('withdraw.html')

@app.route('/transfer', methods=['GET', 'POST'])
def transfer():
    """Handles transferring funds to another user."""
    if 'user_id' not in session:
        return redirect(url_for('login'))

    if request.method == 'POST':
        recipient_username = request.form['recipient_username']
        try:
            amount = float(request.form['amount'])
            sender = User.query.get(session['user_id'])
            recipient = User.query.filter_by(username=recipient_username).first()

            if not recipient:
                flash('Recipient user not found.', 'danger')
                return redirect(url_for('transfer'))
            if recipient.id == sender.id:
                flash('Cannot transfer money to yourself.', 'warning')
                return redirect(url_for('transfer'))
            if amount <= 0:
                flash('Transfer amount must be positive.', 'warning')
                return redirect(url_for('transfer'))
            if amount > sender.balance:
                flash('Insufficient funds.', 'danger')
                return redirect(url_for('transfer'))

            # Perform the transfer
            sender.balance -= amount
            recipient.balance += amount

            # Record transactions for both sender and recipient
            sender_transaction = Transaction(user_id=sender.id, type='Transfer', amount=-amount, description=f'To {recipient.username}')
            recipient_transaction = Transaction(user_id=recipient.id, type='Transfer', amount=amount, description=f'From {sender.username}')

            db.session.add(sender_transaction)
            db.session.add(recipient_transaction)
            db.session.commit()

            flash(f'Successfully transferred ${amount:.2f} to {recipient.username}', 'success')
            return redirect(url_for('dashboard'))
        except ValueError:
            flash('Invalid amount entered.', 'danger')
            return redirect(url_for('transfer'))

    return render_template('transfer.html')


@app.route('/history')
def history():
    """Displays the full transaction history for the logged-in user."""
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])
    all_transactions = Transaction.query.filter_by(user_id=user.id).order_by(Transaction.timestamp.desc()).all()
    return render_template('history.html', transactions=all_transactions)

@app.route('/logout')
def logout():
    """Logs the user out by clearing the session."""
    session.pop('user_id', None)
    session.pop('username', None)
    flash('You have been logged out.', 'info')
    return redirect(url_for('login'))

# --- Main Execution ---
if __name__ == '__main__':
    # The debug=True argument allows for live reloading and provides detailed error pages.
    # This should be set to False in a production environment.
    app.run(debug=True)
