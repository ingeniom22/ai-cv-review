import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import './App.css';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { useCallback } from 'react';
import { Container, Grid, Paper, Title, Text, LoadingOverlay, Stack, Divider, FileInput, Group, rem } from '@mantine/core';
import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

// Initialize PDF.js worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();


// function highlightPattern(text, pattern) {
//   return text.replace(pattern, (value) => `<mark>${value}</mark>`);
// }

function getGradeColor(grade) {
  const gradeColors = {
    'A': '#10b981', // Emerald
    'B': '#3b82f6', // Blue  
    'C': '#f59e0b', // Amber
    'D': '#ef4444', // Red
    'F': '#991b1b'  // Dark Red
  };

  if (typeof grade === 'string') {
    const letter = grade.charAt(0).toUpperCase();
    return gradeColors[letter] || '#6b7280';
  }

  // Numeric grades
  if (grade >= 90) return gradeColors['A'];
  if (grade >= 80) return gradeColors['B'];
  if (grade >= 70) return gradeColors['C'];
  if (grade >= 60) return gradeColors['D'];
  return gradeColors['F'];
}

function highlightPattern(text, patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) return text;

  const escapedPatterns = patterns.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escapedPatterns.join('|')})`, 'gi');

  return text.replace(regex, (value) => `<mark>${value}</mark>`);
}

// async function gradeSections(sections) {
//   const results = await Promise.all(
//     sections.map(async (section) => {
//       const response = await fetch('http://localhost:3000/grade', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ texts: section }),
//       });

//       if (!response.ok) {
//         throw new Error(`Failed to grade section: ${response.statusText}`);
//       }

//       return response.json();
//     })
//   );

//   return results; // List of { texts, grade, critics }
// }

// function hashString(str) {
//   return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str))
//     .then((hashBuffer) => {
//       return Array.from(new Uint8Array(hashBuffer))
//         .map((b) => b.toString(16).padStart(2, "0"))
//         .join("");
//     });
// }


function splitBySectionBreak(input) {
  const sections = [];
  let currentSection = [];

  for (const line of input) {
    const trimmed = line.trim();

    // Skip lines that are empty, only whitespace, or too short
    if (trimmed === '[SECTION_BREAK]') {
      if (currentSection.length > 0) {
        sections.push(currentSection);
        currentSection = [];
      }
    } else if (trimmed.length > 1) {
      currentSection.push(trimmed);
    }
  }

  if (currentSection.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

function App() {
  const [searchText, setSearchText] = useState([]);
  // const [sections, setSections] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [numPages, setNumPages] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [error, setError] = useState(null);


  const textRenderer = useCallback(
    (textItem) => highlightPattern(textItem.str, searchText),
    [searchText]
  );

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const onDocumentLoadError = (error) => {
    console.error('Error loading PDF:', error);
    setError('Failed to load PDF preview');
    setLoading(false);
  };



  const handleFileUpload = async (event) => {
    try {
      setLoading(true);
      setError(null);
      const file = event.target.files[0];

      if (!file || file.type !== 'application/pdf') {
        setError('Please upload a PDF file');
        return;
      }

      // Set PDF file for preview first
      setPdfFile(file);

      // Handle text extraction
      const buffer = await file.arrayBuffer();
      const pdfData = new Uint8Array(buffer);

      try {
        const pdf = await pdfjs.getDocument({ data: pdfData }).promise;

        const allLSections = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const content = await page.getTextContent();
          console.log('Content:', content);

          const lines = [];

          let lastY = null;
          for (const item of content.items) {
            const isBlank = item.width === 0 && item.height === 0;
            const currentY = item.transform[5];

            if (isBlank) {
              // Add section break only if there's a large vertical gap
              if (lastY !== null && Math.abs(currentY - lastY) > 22) {
                lines.push('[SECTION_BREAK]');
              }
              continue; // always skip blank items
            }
            lastY = currentY;
            lines.push(item.str);
          }

          // console.log('Lines:', lines);

          const sections = splitBySectionBreak(lines);
          // console.log('Sections:', sections);

          allLSections.push(...sections);

        }


        console.log('All Sections:', allLSections);

        const gradedSections = await Promise.all(
          allLSections.map(async (section) => {
            const response = await fetch(`${API_URL}/grade`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ texts: section }),
            });

            if (!response.ok) {
              throw new Error(`Failed to grade section: ${response.statusText}`);
            }

            return response.json();
          })
        );

        console.log('Graded Sections:', gradedSections);

        setResults(gradedSections);






      } catch (extractError) {
        console.error('Error extracting text:', extractError);
        setError('Failed to extract text from PDF');
      }

    } catch (error) {
      console.error('Error processing PDF file:', error);
      setError('Error processing PDF file. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <MantineProvider theme={{ colorScheme: 'dark' }}>

      <Container
        fluid
        px={0}
        style={{
          width: '80vw',
          margin: '0 auto',
          maxWidth: 'none',
          // background: 'linear-gradient(135deg, #e0c3fc,rgb(4, 10, 17))',
        }}
      >
        {/* Header Section */}
        <div style={{
          textAlign: 'center',
          marginBottom: rem(32),
          padding: rem(24),
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: rem(16),
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <Title
            order={1}
            style={{
              color: 'purple',
              fontSize: rem(42),
              fontWeight: 800,
              letterSpacing: rem(2),
              textShadow: '0 4px 20px rgba(212, 159, 205, 0.3)',
              marginBottom: rem(8)
            }}
          >
            CV REVIEW
          </Title>
          <Text size="lg" style={{
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: rem(18),
            fontWeight: 300
          }}>
            Professional Resume Analysis & Enhancement
          </Text>
        </div>

        <div style={{
          display: 'flex',
          gap: rem(20),
          height: 'calc(100vh - 200px)',
        }}>
          {/* Left Column: Analysis Results */}
          <div style={{ flex: '1', minWidth: 0 }}>
            <Paper
              shadow="xl"
              radius="xl"
              style={{
                height: '100%',
                overflow: 'hidden',
                background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                border: '1px solid rgba(255, 255, 255, 0.8)',
                position: 'relative'
              }}
            >
              {/* Decorative top border */}
              <div style={{
                height: rem(4),
                background: 'linear-gradient(90deg, #667eea, #764ba2)',
                borderRadius: `${rem(12)} ${rem(12)} 0 0`
              }} />

              <div style={{ padding: rem(32), height: 'calc(100% - 4px)', overflow: 'auto' }}>
                <Group justify="space-between" align="center" mb="xl">
                  <div>
                    <Title order={2} style={{
                      color: "#1a1a1a",
                      fontSize: rem(28),
                      fontWeight: 600,
                      marginBottom: rem(4)
                    }}>
                      Analysis Results
                    </Title>
                    <Text size="sm" c="dimmed" style={{ fontWeight: 500 }}>
                      AI-powered insights and recommendations
                    </Text>
                  </div>
                  <div style={{
                    width: rem(48),
                    height: rem(48),
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: rem(20),
                    fontWeight: 'bold'
                  }}>
                    AI
                  </div>
                </Group>

                {loading && <LoadingOverlay visible />}

                {error && (
                  <Paper p="md" radius="md" style={{
                    background: 'linear-gradient(135deg, #fee2e2, #fecaca)',
                    border: '1px solid #fca5a5'
                  }}>
                    <Text color="red" fw={500}>
                      {error}
                    </Text>
                  </Paper>
                )}

                <Stack gap="lg">
                  {results.length > 0 ? (
                    results.map((result) => (
                      <Paper
                        key={result.id}
                        p="xl"
                        radius="lg"
                        shadow="sm"
                        style={{
                          cursor: 'pointer',
                          background: searchText === result.texts
                            ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
                            : 'white',
                          border: searchText === result.texts
                            ? '2px solid #3b82f6'
                            : '1px solid #e5e7eb',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          transform: 'translateY(0)',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                        onClick={() => setSearchText(result.texts)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';
                        }}
                      >
                        {/* Gradient accent line */}
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: rem(3),
                          background: `linear-gradient(90deg, ${getGradeColor(result.grade)}, ${getGradeColor(result.grade)}88)`
                        }} />

                        <Group justify="space-between" align="flex-start" mb="md">
                          <div style={{
                            padding: `${rem(8)} ${rem(16)}`,
                            borderRadius: rem(20),
                            background: getGradeColor(result.grade),
                            color: 'white',
                            fontWeight: 600,
                            fontSize: rem(14),
                            boxShadow: `0 4px 12px ${getGradeColor(result.grade)}40`
                          }}>
                            Grade: {result.grade}
                          </div>
                          <Text size="xs" c="dimmed" style={{
                            fontFamily: 'monospace',
                            background: '#f1f5f9',
                            padding: `${rem(4)} ${rem(8)}`,
                            borderRadius: rem(4)
                          }}>
                            #{result.id.slice(0, 8)}
                          </Text>
                        </Group>

                        <Text
                          size="sm"
                          mb="md"
                          style={{
                            fontFamily: "Monaco, 'Courier New', monospace",
                            background: '#f8fafc',
                            padding: rem(12),
                            borderRadius: rem(8),
                            border: '1px solid #e2e8f0',
                            lineHeight: 1.6
                          }}
                        >
                          {result.texts.join(' ')}
                        </Text>

                        <div style={{
                          padding: rem(12),
                          background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                          borderRadius: rem(8),
                          borderLeft: `4px solid ${getGradeColor(result.grade)}`
                        }}>
                          <Text c="gray" size="sm" style={{ fontStyle: 'italic', lineHeight: 1.5 }}>
                            💡 {result.critics}
                          </Text>
                        </div>
                      </Paper>
                    ))
                  ) : (
                    <div style={{
                      textAlign: 'center',
                      padding: rem(48),
                      color: '#6b7280'
                    }}>
                      <div style={{
                        fontSize: rem(48),
                        marginBottom: rem(16),
                        opacity: 0.5
                      }}>
                        📄
                      </div>
                      <Text size="lg" fw={500} mb="sm">No analysis available yet</Text>
                      <Text size="sm" c="dimmed">Upload a PDF to get started with AI analysis</Text>
                    </div>
                  )}
                </Stack>
              </div>
            </Paper>
          </div>

          {/* Elegant Divider */}
          <div style={{
            width: rem(2),
            background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.6), transparent)',
            borderRadius: rem(1),
            flexShrink: 0,
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: rem(12),
              height: rem(12),
              background: 'white',
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.8)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }} />
          </div>

          {/* Right Column: PDF Viewer */}
          <div style={{ flex: '1', minWidth: 0 }}>
            <Paper
              shadow="xl"
              radius="xl"
              style={{
                height: '100%',
                background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                border: '1px solid rgba(255, 255, 255, 0.8)',
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              {/* Decorative top border */}
              <div style={{
                height: rem(4),
                background: 'linear-gradient(90deg, #764ba2, #667eea)',
                borderRadius: `${rem(12)} ${rem(12)} 0 0`
              }} />

              <div style={{ padding: rem(32), height: 'calc(100% - 4px)', overflow: 'auto' }}>
                <Group justify="space-between" align="center" mb="xl">
                  <div>
                    <Title order={2} style={{
                      color: "#1a1a1a",
                      fontSize: rem(28),
                      fontWeight: 600,
                      marginBottom: rem(4)
                    }}>
                      Document Viewer
                    </Title>
                    <Text size="sm" c="dimmed" style={{ fontWeight: 500 }}>
                      Upload and preview your resume
                    </Text>
                  </div>
                  <div style={{
                    width: rem(48),
                    height: rem(48),
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #764ba2, #667eea)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: rem(18)
                  }}>
                    📄
                  </div>
                </Group>

                <FileInput
                  label={
                    <Text fw={600} size="sm" mb="xs" style={{ color: '#374151' }}>
                      Upload your PDF resume
                    </Text>
                  }
                  placeholder="Choose your resume file..."
                  accept=".pdf"
                  onChange={(file) => {
                    if (file) {
                      handleFileUpload({ target: { files: [file] } });
                    }
                  }}
                  disabled={loading}
                  mb="xl"
                  radius="lg"
                  size="md"
                  style={{
                    '& .mantine-FileInput-input': {
                      border: '2px dashed #d1d5db',
                      borderRadius: rem(12),
                      padding: rem(16),
                      background: 'white',
                      transition: 'all 0.2s ease',
                    }
                  }}
                />

                {pdfFile && (
                  <div style={{
                    borderRadius: rem(12),
                    overflow: "hidden",
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}>
                    <div style={{
                      padding: rem(16),
                      background: 'linear-gradient(90deg, #f8fafc, #f1f5f9)',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      <Text size="sm" fw={600} c="dimmed">
                        📄 PDF Preview
                      </Text>
                    </div>
                    <div style={{ padding: rem(16) }}>
                      <Document
                        file={pdfFile}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        className="pdf-document"
                        loading={
                          <div style={{
                            textAlign: 'center',
                            padding: rem(48),
                            color: '#6b7280'
                          }}>
                            <div style={{ fontSize: rem(32), marginBottom: rem(16) }}>⏳</div>
                            <Text>Loading PDF...</Text>
                          </div>
                        }
                      >
                        {Array.from(new Array(numPages), (el, index) => (
                          <Page
                            key={`page_${index + 1}`}
                            pageNumber={index + 1}
                            className="pdf-page"
                            width={Math.min(500, window.innerWidth * 0.35)}
                            loading={
                              <div style={{
                                textAlign: 'center',
                                padding: rem(24),
                                color: '#9ca3af'
                              }}>
                                Loading page {index + 1}...
                              </div>
                            }
                            customTextRenderer={textRenderer}
                            style={{
                              marginBottom: rem(16),
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                              borderRadius: rem(8)
                            }}
                          />
                        ))}
                      </Document>
                    </div>
                  </div>
                )}

                {!pdfFile && (
                  <div style={{
                    textAlign: 'center',
                    padding: rem(48),
                    border: '2px dashed #d1d5db',
                    borderRadius: rem(12),
                    background: 'linear-gradient(135deg, #f9fafb, #f3f4f6)'
                  }}>
                    <div style={{
                      fontSize: rem(48),
                      marginBottom: rem(16),
                      opacity: 0.5
                    }}>
                      📎
                    </div>
                    <Text size="lg" fw={500} mb="sm" c="dimmed">
                      No document uploaded
                    </Text>
                    <Text size="sm" c="dimmed">
                      Select a PDF file to begin analysis
                    </Text>
                  </div>
                )}
              </div>
            </Paper>
          </div>
        </div>
      </Container>


      <style jsx>{`
    .pdf-page canvas {
      border-radius: 8px !important;
    }
  `}</style>
    </MantineProvider>
  );
}

export default App;
