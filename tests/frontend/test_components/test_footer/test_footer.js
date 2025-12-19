import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import Footer from '@/components/Footer/Footer';

describe('Footer', () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <Footer />
      </BrowserRouter>
    );
  };

  test('should render footer brand name', () => {
    renderComponent();
    
    expect(screen.getByText('WonderAI Journeys')).toBeInTheDocument();
  });

  test('should render footer tagline', () => {
    renderComponent();
    
    expect(screen.getByText(/Plan smarter, travel better/)).toBeInTheDocument();
  });

  test('should render all social media links', () => {
    renderComponent();
    
    const facebookLink = screen.getByLabelText('Facebook');
    const whatsappLink = screen.getByLabelText('WhatsApp');
    const telegramLink = screen.getByLabelText('Telegram');
    
    expect(facebookLink).toBeInTheDocument();
    expect(whatsappLink).toBeInTheDocument();
    expect(telegramLink).toBeInTheDocument();
  });

  test('should have correct Facebook link', () => {
    renderComponent();
    
    const facebookLink = screen.getByLabelText('Facebook');
    expect(facebookLink).toHaveAttribute('href', 'https://www.facebook.com/profile.php?id=61585391516813');
    expect(facebookLink).toHaveAttribute('target', '_blank');
  });

  test('should render Quick Links section', () => {
    renderComponent();
    
    expect(screen.getByText('Quick Links')).toBeInTheDocument();
  });

  test('should render all quick links', () => {
    renderComponent();
    
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Explore')).toBeInTheDocument();
    expect(screen.getByText('My Trips')).toBeInTheDocument();
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  test('should render Contact Us section', () => {
    renderComponent();
    
    expect(screen.getByText('Contact Us')).toBeInTheDocument();
  });

  test('should render email link', () => {
    renderComponent();
    
    const emailLink = screen.getByText('hellowonderai@gmail.com');
    expect(emailLink).toHaveAttribute('href', 'mailto:hellowonderai@gmail.com');
  });

  test('should render phone link', () => {
    renderComponent();
    
    const phoneLink = screen.getByText('+84 99999 9999');
    expect(phoneLink).toHaveAttribute('href', 'tel:+84 99999 99999');
  });

  test('should render address', () => {
    renderComponent();
    
    expect(screen.getByText('136 Nguyen Van Cu, District 1, Ho Chi Minh City')).toBeInTheDocument();
  });

  test('should toggle map visibility when View on Map button is clicked', () => {
    const { container } = renderComponent();

    const viewMapButton = screen.getByText('View on Map');

    // Initially no map iframe
    expect(container.querySelector('iframe')).not.toBeInTheDocument();

    // Click to show map
    fireEvent.click(viewMapButton);
    expect(container.querySelector('iframe')).toBeInTheDocument();
    expect(screen.getByText('Hide Map')).toBeInTheDocument();

    // Click to hide map
    const hideMapButton = screen.getByText('Hide Map');
    fireEvent.click(hideMapButton);
    expect(container.querySelector('iframe')).not.toBeInTheDocument();
  });

  test('should render Google Maps iframe with correct src', () => {
    const { container } = renderComponent();

    const viewMapButton = screen.getByText('View on Map');
    fireEvent.click(viewMapButton);

    const iframe = container.querySelector('iframe');
    expect(iframe).toHaveAttribute('src', expect.stringContaining('google.com/maps/embed'));
  });

  test('should render Need Support section', () => {
    renderComponent();
    
    expect(screen.getByText('Need Support?')).toBeInTheDocument();
  });

  test('should render support email link', () => {
    renderComponent();
    
    const supportLink = screen.getByText('support@wonderai.travel');
    expect(supportLink).toHaveAttribute('href', 'mailto:support@wonderai.travel');
  });

  test('should render copyright with current year', () => {
    renderComponent();
    
    const currentYear = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`© ${currentYear}`))).toBeInTheDocument();
  });

  test('should render Terms link', () => {
    renderComponent();
    
    const termsLink = screen.getByTitle('Terms of Service');
    expect(termsLink).toHaveAttribute('href', '/terms');
  });

  test('should render Privacy link', () => {
    renderComponent();
    
    const privacyLink = screen.getByTitle('Privacy Policy');
    expect(privacyLink).toHaveAttribute('href', '/privacy');
  });

  test('should have proper footer structure', () => {
    const { container } = renderComponent();
    
    const footer = container.querySelector('footer');
    expect(footer).toHaveClass('wonderai-footer');
  });

  test('should render Facebook Page link in quick links', () => {
    renderComponent();
    
    const fbPageLink = screen.getByText('Facebook Page');
    expect(fbPageLink).toHaveAttribute('href', 'https://www.facebook.com/profile.php?id=61585391516813');
  });

  test('should have target="_blank" on external links', () => {
    renderComponent();
    
    const externalLinks = screen.getAllByRole('link', { target: '_blank' });
    expect(externalLinks.length).toBeGreaterThan(0);
  });

  test('should have rel="noreferrer" on external links', () => {
    renderComponent();
    
    const facebookLink = screen.getByLabelText('Facebook');
    expect(facebookLink).toHaveAttribute('rel', 'noreferrer');
  });
});