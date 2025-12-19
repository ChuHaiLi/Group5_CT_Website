import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LocationCard from '@/components/Navbar/LocationCard';

describe('LocationCard', () => {
  const mockLocation = {
    name: 'Hanoi Old Quarter',
    description: 'Historic district with narrow streets and traditional architecture',
    image_url: 'https://example.com/hanoi.jpg'
  };

  test('should render location name', () => {
    render(<LocationCard location={mockLocation} />);
    
    expect(screen.getByText('Hanoi Old Quarter')).toBeInTheDocument();
  });

  test('should render location description', () => {
    render(<LocationCard location={mockLocation} />);
    
    expect(screen.getByText('Historic district with narrow streets and traditional architecture')).toBeInTheDocument();
  });

  test('should render location image when provided', () => {
    render(<LocationCard location={mockLocation} />);
    
    const image = screen.getByAltText('Hanoi Old Quarter');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/hanoi.jpg');
    expect(image).toHaveAttribute('width', '200');
  });

  test('should not render image when image_url is null', () => {
    const locationWithoutImage = {
      name: 'Test Location',
      description: 'Test description',
      image_url: null
    };
    
    render(<LocationCard location={locationWithoutImage} />);
    
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('should not render image when image_url is undefined', () => {
    const locationWithoutImage = {
      name: 'Test Location',
      description: 'Test description'
    };
    
    render(<LocationCard location={locationWithoutImage} />);
    
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('should render with minimal location data', () => {
    const minimalLocation = {
      name: 'Minimal Location',
      description: 'Minimal description'
    };
    
    render(<LocationCard location={minimalLocation} />);
    
    expect(screen.getByText('Minimal Location')).toBeInTheDocument();
    expect(screen.getByText('Minimal description')).toBeInTheDocument();
  });

  test('should handle empty description', () => {
    const locationWithEmptyDesc = {
      name: 'Test Location',
      description: '',
      image_url: 'https://example.com/test.jpg'
    };
    
    render(<LocationCard location={locationWithEmptyDesc} />);
    
    expect(screen.getByText('Test Location')).toBeInTheDocument();
    const description = screen.getByText('');
    expect(description).toBeInTheDocument();
  });

  test('should handle special characters in name', () => {
    const locationWithSpecialChars = {
      name: 'Hội An & Đà Nẵng',
      description: 'Beautiful cities',
      image_url: 'https://example.com/hoian.jpg'
    };
    
    render(<LocationCard location={locationWithSpecialChars} />);
    
    expect(screen.getByText('Hội An & Đà Nẵng')).toBeInTheDocument();
  });

  test('should handle long description', () => {
    const locationWithLongDesc = {
      name: 'Test Location',
      description: 'This is a very long description that contains many words and characters to test how the component handles lengthy text content. It should render properly without breaking the layout.',
      image_url: 'https://example.com/test.jpg'
    };
    
    render(<LocationCard location={locationWithLongDesc} />);
    
    expect(screen.getByText(/This is a very long description/)).toBeInTheDocument();
  });

  test('should render name in h3 tag', () => {
    render(<LocationCard location={mockLocation} />);
    
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveTextContent('Hanoi Old Quarter');
  });

  test('should render description in p tag', () => {
    const { container } = render(<LocationCard location={mockLocation} />);
    
    const paragraph = container.querySelector('p');
    expect(paragraph).toHaveTextContent('Historic district with narrow streets and traditional architecture');
  });
});