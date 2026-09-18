import React, { useState, useEffect } from 'react';
import { Template, Board } from '../types';
import { templateApi } from '../services/api';
import { useResource, useAction, ActionOutcome } from '../hooks/useRequest';

interface TemplateCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, templateId?: string) => Promise<ActionOutcome<Board | null>>;
}

export const TemplateCenter: React.FC<TemplateCenterProps> = ({ isOpen, onClose, onCreate }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [name, setName] = useState('');

  // 统一读取流程：弹窗打开时加载模板列表，失败给出行内错误
  const {
    data: templatesData,
    loading,
    error: loadError,
    reload: reloadTemplates,
  } = useResource<Template[], []>(() => templateApi.getTemplates(), {
    immediate: false,
    scope: '加载模板列表',
    errorMessage: '加载模板失败，请刷新重试',
  });
  const templates = templatesData ?? [];

  // 统一创建流程：在途期间重复提交复用同一请求，杜绝重复白板
  const {
    executing: creating,
    error: createError,
    clearError: clearCreateError,
    run: runCreate,
  } = useAction(onCreate, { scope: '创建白板', errorMessage: '创建白板失败，请重试' });

  useEffect(() => {
    if (isOpen) {
      void reloadTemplates();
      clearCreateError();
      setSelectedTemplate(null);
      setName('');
    }
  }, [isOpen, reloadTemplates, clearCreateError]);

  // 统一行内错误：列表加载失败 / 创建失败（同一类错误同一文案，同一展示位）
  const error = createError || loadError;

  if (!isOpen) return null;

  const submitCreate = async (templateId?: string) => {
    const fallbackName =
      templateId
        ? templates.find((t) => t._id === templateId)?.name || '未命名白板'
        : '未命名白板';
    const boardName = name.trim() || fallbackName;

    const outcome = await runCreate(boardName, templateId);
    if (outcome.ok) {
      setName('');
      setSelectedTemplate(null);
      onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    void submitCreate(selectedTemplate || undefined);
  };

  const handleCreateBlank = () => {
    if (creating) return;
    void submitCreate(undefined);
  };

  const TemplateCard: React.FC<{
    template: Template;
    selected: boolean;
    onClick: () => void;
  }> = ({ template, selected, onClick }) => (
    <div
      onClick={onClick}
      style={{
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: 'pointer',
        border: selected ? '2px solid #667eea' : '2px solid transparent',
        boxShadow: selected
          ? '0 8px 24px rgba(102, 126, 234, 0.25)'
          : '0 2px 8px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.2s',
        background: '#fff',
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
        }
      }}
    >
      <div
        style={{
          height: '140px',
          background: template.thumbnail,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <span
          style={{
            fontSize: '48px',
          }}
        >
          {template.icon}
        </span>
        {selected && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: '#667eea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>
      <div style={{ padding: '16px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 600,
            color: '#1a1a1a',
            marginBottom: '6px',
          }}
        >
          {template.name}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            color: '#6b7280',
            lineHeight: 1.5,
          }}
        >
          {template.description}
        </p>
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          width: '900px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '24px 32px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '22px',
                fontWeight: 600,
                color: '#1a1a1a',
              }}
            >
              模板中心
            </h2>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '14px',
                color: '#6b7280',
              }}
            >
              选择一个模板快速开始，或创建空白白板
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7280',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              padding: '24px 32px',
              borderBottom: '1px solid #e5e7eb',
            }}
          >
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: '#374151',
                marginBottom: '8px',
              }}
            >
              白板名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                selectedTemplate
                  ? templates.find((t) => t._id === selectedTemplate)?.name || '请输入白板名称'
                  : '请输入白板名称'
              }
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d1d5db';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 32px',
            }}
          >
            <div style={{ marginBottom: '24px' }}>
              <h3
                style={{
                  margin: '0 0 16px',
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>📄</span> 空白白板
              </h3>
              <div
                onClick={() => setSelectedTemplate(null)}
                style={{
                  width: '220px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: selectedTemplate === null ? '2px solid #667eea' : '2px solid transparent',
                  boxShadow: selectedTemplate === null
                    ? '0 8px 24px rgba(102, 126, 234, 0.25)'
                    : '0 2px 8px rgba(0, 0, 0, 0.08)',
                  transition: 'all 0.2s',
                  background: '#fff',
                }}
                onMouseEnter={(e) => {
                  if (selectedTemplate !== null) {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedTemplate !== null) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                  }
                }}
              >
                <div
                  style={{
                    height: '140px',
                    background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#9ca3af"
                    strokeWidth="1.5"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="9" y1="9" x2="15" y2="9" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                  {selectedTemplate === null && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: '#667eea',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </div>
                <div style={{ padding: '16px' }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: 600,
                      color: '#1a1a1a',
                    }}
                  >
                    空白白板
                  </h3>
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: '13px',
                      color: '#6b7280',
                    }}
                  >
                    从零开始创建
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3
                style={{
                  margin: '0 0 16px',
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>✨</span> 精选模板
              </h3>
              {loading ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '16px',
                  }}
                >
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        borderRadius: '12px',
                        height: '200px',
                        background: '#f3f4f6',
                        animation: 'pulse 1.5s ease-in-out infinite',
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '16px',
                  }}
                >
                  {templates.map((template) => (
                    <TemplateCard
                      key={template._id}
                      template={template}
                      selected={selectedTemplate === template._id}
                      onClick={() => setSelectedTemplate(template._id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              padding: '20px 32px',
              borderTop: '1px solid #e5e7eb',
              background: '#f9fafb',
            }}
          >
            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#dc2626',
                  fontSize: '13px',
                  marginBottom: '12px',
                }}
              >
                {error}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: '13px', color: '#6b7280' }}>
                {selectedTemplate
                  ? `已选择：${templates.find((t) => t._id === selectedTemplate)?.name}`
                  : '已选择：空白白板'}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={creating}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#374151',
                    background: '#e5e7eb',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: creating ? 'not-allowed' : 'pointer',
                    opacity: creating ? 0.5 : 1,
                  }}
                >
                  取消
                </button>
                {selectedTemplate === null ? (
                  <button
                    type="button"
                    onClick={handleCreateBlank}
                    disabled={creating}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 24px',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#fff',
                      background: '#667eea',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: creating ? 'not-allowed' : 'pointer',
                      transition: 'background 0.2s',
                      opacity: creating ? 0.8 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!creating) e.currentTarget.style.background = '#5a67d8';
                    }}
                    onMouseLeave={(e) => {
                      if (!creating) e.currentTarget.style.background = '#667eea';
                    }}
                  >
                    {creating && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ animation: 'spin 1s linear infinite' }}
                      >
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                        <path d="M4 12a8 8 0 018-8" />
                      </svg>
                    )}
                    {creating ? '创建中...' : '创建空白白板'}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={creating}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 24px',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#fff',
                      background: '#667eea',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: creating ? 'not-allowed' : 'pointer',
                      transition: 'background 0.2s',
                      opacity: creating ? 0.8 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!creating) e.currentTarget.style.background = '#5a67d8';
                    }}
                    onMouseLeave={(e) => {
                      if (!creating) e.currentTarget.style.background = '#667eea';
                    }}
                  >
                    {creating && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ animation: 'spin 1s linear infinite' }}
                      >
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                        <path d="M4 12a8 8 0 018-8" />
                      </svg>
                    )}
                    {creating ? '创建中...' : '使用模板创建'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
