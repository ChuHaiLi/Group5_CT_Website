import React from "react";
import "./HomeIntro.css";

export default function HomeIntro() {
  return (
    <section className="home-intro">
      <div className="intro-features">
        <h2 className="intro-main-title">Why arrange with WonderAI?</h2>
        <div className="feature-grid">
          <div className="feature-item">
            <div className="feature-icon">📞</div>
            <h3>24/7 customer support</h3>
            <p>No matter the time zone, we're here to help.</p>
          </div>

          <div className="feature-item">
            <div className="feature-icon">🎈</div>
            <h3>Easy to use</h3>
            <p>Explore, plan and get advise from AI assistant.</p>
          </div>

          <div className="feature-item">
            <div className="feature-icon">⭐</div>
            <h3>Millions of reviews</h3>
            <p>Plan and book with confidence using reviews and suggestions from AI.</p>
          </div>

          <div className="feature-item">
            <div className="feature-icon">📅</div>
            <h3>Plan your way</h3>
            <p>Stay flexible with free customization of your own trip.</p>
          </div>
        </div>
      </div>

      <div className="intro-highlights">
        <div className="highlight">
          <h3>All-in-One Trip Wizard</h3>
          <p>
            Manage, refine, and compare all your travel plans in one AI-powered tool.
          </p>
        </div>

        <div className="highlight">
          <h3>Traveling Expert Eyes</h3>
          <p>
            Discover places through images—AI recognizes destinations from your photos.
          </p>
        </div>
      </div>

      <div className="intro-reviews">
        <div className="reviews-left">
          <h3>Excellent</h3>
          <div className="review-stars">★★★★★</div>
          <div className="review-meta">Based on 293,545 reviews</div>
        </div>

        <div className="reviews-list">
          <div className="single-review">
            <div className="review-rating">★★★★★</div>
            <div className="review-time">3 hours ago</div>
            <h4>It was a fabulous experience</h4>
            <p>It was a fabulous experience. Love it, enjoy it.</p>
            <div className="review-author">Daniel Tuikhang Koren</div>
          </div>

          <div className="single-review">
            <div className="review-rating">★★★★★</div>
            <div className="review-time">3 hours ago</div>
            <h4>Great time 👍</h4>
            <p>The crew was very friendly, fun and knowledgeable.</p>
            <div className="review-author">Kathleen Sowell</div>
          </div>

          <div className="single-review">
            <div className="review-rating">★★★★★</div>
            <div className="review-time">3 hours ago</div>
            <h4>Great communication</h4>
            <p>Easy and quick communication with my queries.</p>
            <div className="review-author">Craig Moritz</div>
          </div>
        </div>
      </div>
    </section>
  );
}
