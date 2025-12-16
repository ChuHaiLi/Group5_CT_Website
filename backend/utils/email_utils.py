import smtplib
import random
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

def send_email(to_email, subject, html_content):
    """
    Gửi email qua Gmail SMTP
    Cần cấu hình trong .env:
    EMAIL_USER=your-email@gmail.com
    EMAIL_PASSWORD=your-app-password
    
    Returns:
        dict: {"success": bool, "email_configured": bool, "message": str}
    """
    try:
        email_user = os.getenv("EMAIL_USER")
        email_password = os.getenv("EMAIL_PASSWORD")
        
        if not email_user or not email_password:
            print("⚠️  WARNING: EMAIL_USER or EMAIL_PASSWORD not configured")
            print(f"📧 Email would be sent to: {to_email}")
            print(f"📧 Subject: {subject}")
            print(f"📧 Content preview: {html_content[:200]}...")
            
            return {
                "success": True,
                "email_configured": False,
                "message": "Email service not configured. Please check your console for the verification code."
            }
        
        msg = MIMEMultipart('alternative')
        msg['From'] = email_user
        msg['To'] = to_email
        msg['Subject'] = subject
        
        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)
        
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(email_user, email_password)
            server.send_message(msg)
        
        print(f"✅ Email sent successfully to {to_email}")
        
        return {
            "success": True,
            "email_configured": True,
            "message": f"Verification code has been sent to {to_email}"
        }
        
    except Exception as e:
        print(f"❌ Error sending email: {str(e)}")
        
        return {
            "success": False,
            "email_configured": True,
            "message": f"Failed to send email: {str(e)}"
        }

def generate_otp(length=6):
    """Tạo mã OTP ngẫu nhiên gồm 6 chữ số"""
    return ''.join(random.choices(string.digits, k=length))