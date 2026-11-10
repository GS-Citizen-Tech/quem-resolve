// Reserva embutida da base "quem resolve o quê" (gerada de api/app/data/quem_resolve.json).
// Usada só quando a API está fora do ar: o cidadão ainda escolhe a categoria e vê o canal oficial.
import type { Categoria, Responsavel } from "./tipos";

export const RESPONSAVEIS_RESERVA: Responsavel[] = [
  {
    "id": "subprefeitura",
    "nome": "Prefeitura (subprefeitura)",
    "canal": "SP156",
    "contato": "156",
    "url": "https://sp156.prefeitura.sp.gov.br"
  },
  {
    "id": "prefeitura",
    "nome": "Prefeitura de São Paulo",
    "canal": "SP156",
    "contato": "156",
    "url": "https://sp156.prefeitura.sp.gov.br"
  },
  {
    "id": "enel",
    "nome": "Enel",
    "canal": "Central de atendimento Enel",
    "contato": "a validar",
    "url": "https://www.enel.com.br"
  },
  {
    "id": "operadora_telecom",
    "nome": "Operadora dona do cabo (Prefeitura fiscaliza)",
    "canal": "Operadora / SP156",
    "contato": "156",
    "url": "https://sp156.prefeitura.sp.gov.br"
  },
  {
    "id": "policia",
    "nome": "Polícia Militar",
    "canal": "190",
    "contato": "190",
    "url": null
  },
  {
    "id": "sabesp",
    "nome": "Sabesp",
    "canal": "Central de atendimento Sabesp",
    "contato": "a validar",
    "url": "https://www.sabesp.com.br"
  },
  {
    "id": "comgas",
    "nome": "Comgás",
    "canal": "Emergência Comgás",
    "contato": "a validar",
    "url": "https://www.comgas.com.br"
  },
  {
    "id": "proprietario",
    "nome": "Proprietário do imóvel (subprefeitura fiscaliza)",
    "canal": "SP156",
    "contato": "156",
    "url": "https://sp156.prefeitura.sp.gov.br"
  },
  {
    "id": "cet",
    "nome": "CET",
    "canal": "SP156",
    "contato": "156",
    "url": "https://sp156.prefeitura.sp.gov.br"
  },
  {
    "id": "concessionaria_coleta",
    "nome": "Concessionária de coleta (fiscalização municipal)",
    "canal": "SP156",
    "contato": "156",
    "url": "https://sp156.prefeitura.sp.gov.br"
  },
  {
    "id": "defesa_civil",
    "nome": "Defesa Civil",
    "canal": "199",
    "contato": "199",
    "url": null
  }
];

export const CATEGORIAS_RESERVA: Categoria[] = [
  {
    "id": "buraco",
    "nome": "Buraco na via",
    "responsavel_id": "subprefeitura",
    "emergencia": "nao",
    "palavras": [],
    "classes_visao": []
  },
  {
    "id": "iluminacao",
    "nome": "Iluminação pública",
    "responsavel_id": "prefeitura",
    "emergencia": "nao",
    "palavras": [],
    "classes_visao": []
  },
  {
    "id": "fio_energia",
    "nome": "Fio de energia caído ou faiscando",
    "responsavel_id": "enel",
    "emergencia": "sim",
    "palavras": [],
    "classes_visao": []
  },
  {
    "id": "fio_telecom",
    "nome": "Fiação de telecom solta",
    "responsavel_id": "operadora_telecom",
    "emergencia": "nao",
    "palavras": [],
    "classes_visao": []
  },
  {
    "id": "poste",
    "nome": "Poste danificado",
    "responsavel_id": "enel",
    "emergencia": "depende",
    "palavras": [],
    "classes_visao": []
  },
  {
    "id": "vandalismo_fios",
    "nome": "Vandalismo ou furto de fios",
    "responsavel_id": "policia",
    "emergencia": "sim",
    "palavras": [],
    "classes_visao": []
  },
  {
    "id": "vazamento_agua",
    "nome": "Vazamento de água na rua",
    "responsavel_id": "sabesp",
    "emergencia": "depende",
    "palavras": [],
    "classes_visao": []
  },
  {
    "id": "esgoto",
    "nome": "Esgoto",
    "responsavel_id": "sabesp",
    "emergencia": "nao",
    "palavras": [],
    "classes_visao": []
  },
  {
    "id": "gas",
    "nome": "Cheiro de gás",
    "responsavel_id": "comgas",
    "emergencia": "sim",
    "palavras": [],
    "classes_visao": []
  },
  {
    "id": "calcada",
    "nome": "Calçada quebrada",
    "responsavel_id": "proprietario",
    "emergencia": "nao",
    "palavras": [],
    "classes_visao": []
  },
  {
    "id": "arvore",
    "nome": "Árvore (poda ou queda)",
    "responsavel_id": "subprefeitura",
    "emergencia": "depende",
    "palavras": [],
    "classes_visao": []
  },
  {
    "id": "semaforo",
    "nome": "Semáforo com defeito",
    "responsavel_id": "cet",
    "emergencia": "nao",
    "palavras": [],
    "classes_visao": []
  },
  {
    "id": "descarte_irregular",
    "nome": "Descarte irregular ou entulho",
    "responsavel_id": "subprefeitura",
    "emergencia": "nao",
    "palavras": [],
    "classes_visao": []
  },
  {
    "id": "coleta_lixo",
    "nome": "Coleta de lixo não realizada",
    "responsavel_id": "concessionaria_coleta",
    "emergencia": "nao",
    "palavras": [],
    "classes_visao": []
  },
  {
    "id": "lixo_acumulado",
    "nome": "Lixo acumulado em via pública",
    "responsavel_id": "subprefeitura",
    "emergencia": "nao",
    "palavras": [],
    "classes_visao": []
  },
  {
    "id": "boca_de_lobo",
    "nome": "Boca de lobo entupida",
    "responsavel_id": "subprefeitura",
    "emergencia": "depende",
    "palavras": [],
    "classes_visao": []
  },
  {
    "id": "lixeira",
    "nome": "Lixeira pública",
    "responsavel_id": "prefeitura",
    "emergencia": "nao",
    "palavras": [],
    "classes_visao": []
  },
  {
    "id": "varricao",
    "nome": "Varrição",
    "responsavel_id": "prefeitura",
    "emergencia": "nao",
    "palavras": [],
    "classes_visao": []
  },
  {
    "id": "veiculo_abandonado",
    "nome": "Veículo abandonado",
    "responsavel_id": "prefeitura",
    "emergencia": "nao",
    "palavras": [],
    "classes_visao": []
  },
  {
    "id": "alagamento",
    "nome": "Alagamento",
    "responsavel_id": "defesa_civil",
    "emergencia": "depende",
    "palavras": [],
    "classes_visao": []
  }
];
