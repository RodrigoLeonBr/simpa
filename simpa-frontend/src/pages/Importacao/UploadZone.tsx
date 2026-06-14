import { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';
import { previewUpload, uploadCargas } from '../../api/importacao';

interface PreviewItem {
  nome: string;
  tipo_relatorio: string;
  competencia: string;
  unidade: string;
  equipe_nome: string;
  ja_importado: boolean;
}

interface Props {
  onUploadConcluido: () => void;
}

export function UploadZone({ onUploadConcluido }: Props) {
  const [files,     setFiles]     = useState<File[]>([]);
  const [preview,   setPreview]   = useState<PreviewItem[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [dragging,  setDragging]  = useState(false);

  const processarArquivos = useCallback(async (novosFiles: File[]) => {
    setFiles(novosFiles);
    setLoading(true);
    try {
      const resultado = await previewUpload(novosFiles);
      setPreview(resultado);
    } catch (e) {
      console.error('Erro no preview:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'));
    if (dropped.length) processarArquivos(dropped);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selecionados = Array.from(e.target.files || []);
    if (selecionados.length) processarArquivos(selecionados);
  };

  const handleProcessar = async () => {
    setLoading(true);
    try {
      await uploadCargas(files);
      setFiles([]);
      setPreview([]);
      onUploadConcluido();
    } catch (e) {
      console.error('Erro no upload:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      className={`border-2 border-dashed rounded-xl p-5 transition-colors ${
        dragging ? 'border-brand-blue bg-blue-900/10' : 'border-dark-600 bg-dark-800'
      }`}
    >
      {preview.length === 0 ? (
        <label className="flex flex-col items-center gap-2 cursor-pointer">
          <Upload size={28} className="text-slate-500" />
          <p className="text-sm text-slate-300 font-medium">Arraste os CSVs do e-SUS aqui</p>
          <p className="text-xs text-slate-500">ou clique para selecionar — múltiplos arquivos permitidos</p>
          <p className="text-[10px] text-dark-500">ISO-8859-1 convertido automaticamente</p>
          <input type="file" accept=".csv" multiple onChange={handleFileInput} className="hidden" />
        </label>
      ) : (
        <div className="flex flex-col gap-2">
          {preview.map((p, i) => (
            <div key={i} className="flex items-center gap-2 bg-dark-700 rounded px-3 py-2">
              <span className="text-green-400 text-xs">✓</span>
              <span className="text-slate-300 text-xs flex-1 truncate">{p.nome}</span>
              <span className="bg-blue-900/50 text-sky-300 text-[9px] px-1.5 py-0.5 rounded">
                {p.tipo_relatorio}
              </span>
              {p.ja_importado && (
                <span className="bg-amber-900/50 text-amber-400 text-[9px] px-1.5 py-0.5 rounded">
                  já importado
                </span>
              )}
              <span className="text-slate-500 text-[9px]">
                {p.competencia?.slice(0,7)} · {p.unidade?.slice(0,20)} · {p.equipe_nome}
              </span>
            </div>
          ))}
          <div className="flex gap-2 justify-end mt-1">
            <button
              onClick={() => { setFiles([]); setPreview([]); }}
              className="px-3 py-1.5 text-xs text-slate-500 bg-dark-700 border border-dark-600 rounded hover:text-slate-300"
            >
              Cancelar
            </button>
            <button
              onClick={handleProcessar}
              disabled={loading}
              className="px-4 py-1.5 text-xs text-white bg-brand-blue rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Processando…' : `Processar ${files.length} arquivo(s) →`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
