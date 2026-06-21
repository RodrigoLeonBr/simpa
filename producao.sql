-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Tempo de geração: 20/06/2026 às 14:03
-- Versão do servidor: 10.4.32-MariaDB
-- Versão do PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Banco de dados: `producao`
--

-- --------------------------------------------------------

--
-- Estrutura para tabela `cache`
--

CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `cache_locks`
--

CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `cbo`
--

CREATE TABLE `cbo` (
  `CBO` varchar(6) NOT NULL,
  `DS_CBO` varchar(120) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `cismetro`
--

CREATE TABLE `cismetro` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `codigo` varchar(11) NOT NULL,
  `credenciamento` varchar(40) NOT NULL,
  `grupo` varchar(80) NOT NULL,
  `descricao` varchar(180) NOT NULL,
  `valor` decimal(15,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `failed_jobs`
--

CREATE TABLE `failed_jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `forma`
--

CREATE TABLE `forma` (
  `id_registro` int(11) NOT NULL,
  `grupo` varchar(2) NOT NULL,
  `subgrupo` varchar(4) NOT NULL,
  `forma` varchar(6) NOT NULL,
  `descricao` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `jobs`
--

CREATE TABLE `jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) UNSIGNED NOT NULL,
  `reserved_at` int(10) UNSIGNED DEFAULT NULL,
  `available_at` int(10) UNSIGNED NOT NULL,
  `created_at` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `job_batches`
--

CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `prestador`
--

CREATE TABLE `prestador` (
  `re_cunid` varchar(7) NOT NULL,
  `re_cnome` varchar(35) NOT NULL,
  `re_tipo` char(1) NOT NULL,
  `cnpj` varchar(14) DEFAULT NULL,
  `area` int(11) NOT NULL,
  `tipouni` char(1) NOT NULL,
  `relatorio` varchar(40) DEFAULT NULL,
  `ativo` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `procedimento`
--

CREATE TABLE `procedimento` (
  `codigo` varchar(10) NOT NULL DEFAULT '',
  `procedimento` varchar(63) NOT NULL DEFAULT '',
  `PA_TOTAL` decimal(12,2) DEFAULT 0.00,
  `RUB_TOTAL` varchar(4) DEFAULT '',
  `RUB_DC` varchar(40) DEFAULT '',
  `PA_RUB` varchar(4) DEFAULT '',
  `PA_ID` varchar(9) NOT NULL,
  `FINANCIAMENTO` varchar(60) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `sessions`
--

CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `s_apa`
--

CREATE TABLE `s_apa` (
  `APA_UID` varchar(7) DEFAULT NULL,
  `APA_NUM` varchar(13) DEFAULT NULL,
  `APA_EMISSA` varchar(8) DEFAULT NULL,
  `APA_DTINIC` varchar(8) DEFAULT NULL,
  `APA_DTFIM` varchar(8) DEFAULT NULL,
  `APA_TPATEN` varchar(2) DEFAULT NULL,
  `APA_TPAPAC` varchar(1) DEFAULT NULL,
  `APA_NMPCN` varchar(30) DEFAULT NULL,
  `APA_UFPCN` varchar(3) DEFAULT NULL,
  `APA_MAEPCN` varchar(30) DEFAULT NULL,
  `APA_LOGPCN` varchar(30) DEFAULT NULL,
  `APA_NUMPCN` varchar(5) DEFAULT NULL,
  `APA_CPLPCN` varchar(10) DEFAULT NULL,
  `APA_CEPPCN` varchar(8) DEFAULT NULL,
  `APA_MUNPCN` varchar(7) DEFAULT NULL,
  `APA_DTNASC` varchar(8) DEFAULT NULL,
  `APA_SEXPCN` varchar(1) DEFAULT NULL,
  `APA_VARIA` varchar(141) DEFAULT NULL,
  `APA_CPFRES` varchar(11) DEFAULT NULL,
  `APA_NMRES` varchar(30) DEFAULT NULL,
  `APA_MOTCOB` varchar(2) DEFAULT NULL,
  `APA_DTOBAL` varchar(8) DEFAULT NULL,
  `APA_CPFDIR` varchar(11) DEFAULT NULL,
  `APA_NMDIR` varchar(30) DEFAULT NULL,
  `APA_CMP` varchar(6) DEFAULT NULL,
  `APA_MVM` varchar(6) DEFAULT NULL,
  `APA_RMS` varchar(4) DEFAULT NULL,
  `APA_DTGER` varchar(8) DEFAULT NULL,
  `APA_FLER` varchar(10) DEFAULT NULL,
  `APA_INERPP` varchar(1) DEFAULT NULL,
  `APA_PRIPAL` varchar(9) DEFAULT NULL,
  `APA_CPFPCT` varchar(11) DEFAULT NULL,
  `APA_CNSPCT` varchar(15) DEFAULT NULL,
  `APA_CNSRES` varchar(15) DEFAULT NULL,
  `APA_CNSDIR` varchar(15) DEFAULT NULL,
  `APA_CIDCA` varchar(4) DEFAULT NULL,
  `APA_NPRONT` varchar(10) DEFAULT NULL,
  `APA_CODSOL` varchar(7) DEFAULT NULL,
  `APA_DTSOL` varchar(8) DEFAULT NULL,
  `APA_DTAUT` varchar(8) DEFAULT NULL,
  `APA_CODEMI` varchar(10) DEFAULT NULL,
  `APA_CATEND` varchar(2) DEFAULT NULL,
  `APA_APACAN` varchar(14) DEFAULT NULL,
  `APA_RACA` varchar(2) DEFAULT NULL,
  `APA_NOMERE` varchar(30) DEFAULT NULL,
  `APA_ETNIA` varchar(4) DEFAULT NULL,
  `APA_ADVLMC` varchar(1) DEFAULT NULL,
  `APA_ADVTZM` varchar(1) DEFAULT NULL,
  `APA_SRV` varchar(3) DEFAULT NULL,
  `APA_CSF` varchar(3) DEFAULT NULL,
  `APA_CDLOGR` varchar(3) DEFAULT NULL,
  `APA_BAIRRO` varchar(30) DEFAULT NULL,
  `APA_DDD` varchar(2) DEFAULT NULL,
  `APA_TEL` varchar(9) DEFAULT NULL,
  `APA_EMAIL` varchar(40) DEFAULT NULL,
  `APA_CNSEXE` varchar(15) DEFAULT NULL,
  `APA_INE` varchar(10) DEFAULT NULL,
  `APA_ADVSEX` varchar(1) DEFAULT NULL,
  `APA_EXPMAE` varchar(1) DEFAULT NULL,
  `APA_STRUA` varchar(1) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `s_bpi`
--

CREATE TABLE `s_bpi` (
  `BPI_UID` char(7) DEFAULT '',
  `BPI_CMP` char(6) DEFAULT '',
  `BPI_CNSMED` char(15) DEFAULT '',
  `BPI_CBO` char(6) DEFAULT '',
  `BPI_FLH` char(3) DEFAULT '',
  `BPI_SEQ` char(2) DEFAULT '',
  `BPI_PA` char(10) DEFAULT '',
  `BPI_CNSPAC` char(15) DEFAULT '',
  `BPI_NMPAC` char(30) DEFAULT '',
  `BPI_DTNASC` char(8) DEFAULT '',
  `BPI_SEXO` char(1) DEFAULT '',
  `BPI_IBGE` char(6) DEFAULT '',
  `BPI_DTATEN` char(8) DEFAULT '',
  `BPI_CID` char(4) DEFAULT '',
  `BPI_CATEN` char(2) DEFAULT '',
  `BPI_NAUT` char(13) DEFAULT '',
  `BPI_QT_P` int(6) DEFAULT 0,
  `BPI_QT_A` int(6) DEFAULT 0,
  `BPI_IDADE` int(3) DEFAULT 0,
  `BPI_MVM` char(6) DEFAULT '',
  `BPI_ORG` char(3) DEFAULT '',
  `BPI_TPFIN` char(1) DEFAULT '',
  `BPI_RMS` char(4) DEFAULT '',
  `BPI_FLPA` char(1) DEFAULT '',
  `BPI_FLCID` char(1) DEFAULT '',
  `BPI_FLCBO` char(1) DEFAULT '',
  `BPI_FLCA` char(1) DEFAULT '',
  `BPI_FLIDA` char(1) DEFAULT '',
  `BPI_FLQT` char(1) DEFAULT '',
  `BPI_FLER` char(1) DEFAULT '',
  `BPI_RACA` char(2) DEFAULT ''
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `s_pap`
--

CREATE TABLE `s_pap` (
  `PAP_UID` varchar(7) DEFAULT NULL,
  `PAP_CMP` varchar(6) DEFAULT NULL,
  `PAP_NUM` varchar(13) DEFAULT NULL,
  `PAP_PA` varchar(10) DEFAULT NULL,
  `PAP_SEQ` varchar(2) DEFAULT NULL,
  `PAP_CBO` varchar(6) DEFAULT NULL,
  `PAP_IDADE` smallint(6) DEFAULT NULL,
  `PAP_QT_P` double DEFAULT NULL,
  `PAP_QT_A` double DEFAULT NULL,
  `PAP_MVM` varchar(6) DEFAULT NULL,
  `PAP_ORG` varchar(3) DEFAULT NULL,
  `PAP_FLPA` varchar(1) DEFAULT NULL,
  `PAP_FLEMA` varchar(1) DEFAULT NULL,
  `PAP_FLCBO` varchar(1) DEFAULT NULL,
  `PAP_FLQT` varchar(1) DEFAULT NULL,
  `PAP_FLER` varchar(1) DEFAULT NULL,
  `PAP_CNPJ` varchar(14) DEFAULT NULL,
  `PAP_NFISC` varchar(6) DEFAULT NULL,
  `PAP_CIDPRI` varchar(6) DEFAULT NULL,
  `PAP_CIDSEC` varchar(6) DEFAULT NULL,
  `PAP_EQUIPE` varchar(12) DEFAULT NULL,
  `PAP_VL_FED` double DEFAULT NULL,
  `PAP_VL_LOC` double DEFAULT NULL,
  `PAP_VL_INC` double DEFAULT NULL,
  `PAP_INCOUT` varchar(4) DEFAULT NULL,
  `PAP_INCURG` varchar(4) DEFAULT NULL,
  `PAP_RUB` varchar(6) DEFAULT NULL,
  `PAP_TPFIN` varchar(1) DEFAULT NULL,
  `PAP_CPX` varchar(1) DEFAULT NULL,
  `PAP_RC` varchar(4) DEFAULT NULL,
  `PAP_UNTERC` varchar(7) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `s_prd`
--

CREATE TABLE `s_prd` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `prd_uid` varchar(7) NOT NULL,
  `prd_cmp` varchar(6) NOT NULL,
  `prd_flh` char(3) NOT NULL,
  `prd_seq` char(2) NOT NULL,
  `prd_pa` varchar(10) NOT NULL,
  `prd_cbo` varchar(8) NOT NULL,
  `PRD_IDADE` int(3) DEFAULT NULL,
  `PRD_QT_P` int(6) DEFAULT NULL,
  `PRD_QT_A` int(6) DEFAULT NULL,
  `PRD_VL_P` decimal(15,2) DEFAULT NULL,
  `PRD_VL_A` decimal(15,2) DEFAULT NULL,
  `PRD_MVM` varchar(6) DEFAULT '',
  `PRD_ORG` char(3) DEFAULT '',
  `PRD_FLPA` char(1) DEFAULT '',
  `PRD_FLCBO` char(1) DEFAULT '',
  `PRD_FLCA` char(1) DEFAULT '',
  `PRD_FLIDA` char(1) DEFAULT '',
  `PRD_FLQT` char(1) DEFAULT '',
  `PRD_FLER` char(1) DEFAULT '',
  `PRD_APANUM` varchar(13) DEFAULT '',
  `PRD_CNSMED` varchar(15) DEFAULT NULL,
  `PRD_RMS` varchar(4) DEFAULT '',
  `PRD_CNPJ` varchar(14) DEFAULT '',
  `PRD_NFIS` varchar(6) DEFAULT '',
  `PRD_RESID` varchar(6) DEFAULT '',
  `PRD_RUB` varchar(6) DEFAULT '',
  `PRD_CPX` char(1) DEFAULT '',
  `PRD_TPFIN` char(1) DEFAULT '',
  `PRD_QTDATR` int(6) DEFAULT NULL,
  `PRD_QTDATU` int(6) DEFAULT NULL,
  `PRD_RC` varchar(4) DEFAULT '',
  `PRD_CIDPRI` varchar(6) DEFAULT '',
  `PRD_CIDSEC` varchar(6) DEFAULT '',
  `PRD_CIDCAS` varchar(6) DEFAULT '',
  `PRD_INCOUT` varchar(4) DEFAULT '',
  `PRD_INCURG` varchar(4) DEFAULT '',
  `grupo` varchar(2) GENERATED ALWAYS AS (left(`prd_pa`,2)) STORED,
  `subgrupo` varchar(4) GENERATED ALWAYS AS (left(`prd_pa`,4)) STORED,
  `forma` varchar(6) GENERATED ALWAYS AS (left(`prd_pa`,6)) STORED
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `s_rub`
--

CREATE TABLE `s_rub` (
  `RUB_ID` char(4) NOT NULL DEFAULT '',
  `RUB_DC` char(40) NOT NULL DEFAULT '',
  `RUB_TOTAL` char(2) DEFAULT ''
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `users`
--

CREATE TABLE `users` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `username` varchar(255) NOT NULL,
  `password` text NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `first_name` varchar(255) DEFAULT NULL,
  `last_name` varchar(255) DEFAULT NULL,
  `role` varchar(50) NOT NULL DEFAULT 'operator',
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `must_change_password` tinyint(1) NOT NULL DEFAULT 1,
  `password_changed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Índices para tabelas despejadas
--

--
-- Índices de tabela `cache`
--
ALTER TABLE `cache`
  ADD PRIMARY KEY (`key`);

--
-- Índices de tabela `cache_locks`
--
ALTER TABLE `cache_locks`
  ADD PRIMARY KEY (`key`);

--
-- Índices de tabela `cismetro`
--
ALTER TABLE `cismetro`
  ADD PRIMARY KEY (`id`),
  ADD KEY `cismetro_codigo_index` (`codigo`),
  ADD KEY `cismetro_credenciamento_index` (`credenciamento`),
  ADD KEY `cismetro_grupo_index` (`grupo`);

--
-- Índices de tabela `failed_jobs`
--
ALTER TABLE `failed_jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`);

--
-- Índices de tabela `forma`
--
ALTER TABLE `forma`
  ADD PRIMARY KEY (`id_registro`),
  ADD KEY `forma_grupo_index` (`grupo`),
  ADD KEY `forma_subgrupo_index` (`subgrupo`),
  ADD KEY `forma_forma_index` (`forma`);

--
-- Índices de tabela `jobs`
--
ALTER TABLE `jobs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `jobs_queue_index` (`queue`);

--
-- Índices de tabela `job_batches`
--
ALTER TABLE `job_batches`
  ADD PRIMARY KEY (`id`);

--
-- Índices de tabela `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`email`);

--
-- Índices de tabela `prestador`
--
ALTER TABLE `prestador`
  ADD PRIMARY KEY (`re_cunid`),
  ADD KEY `idx_cnpj` (`cnpj`),
  ADD KEY `idx_ativo` (`ativo`);

--
-- Índices de tabela `procedimento`
--
ALTER TABLE `procedimento`
  ADD PRIMARY KEY (`codigo`),
  ADD KEY `idx_pa_id` (`PA_ID`);

--
-- Índices de tabela `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sessions_user_id_index` (`user_id`),
  ADD KEY `sessions_last_activity_index` (`last_activity`);

--
-- Índices de tabela `s_apa`
--
ALTER TABLE `s_apa`
  ADD KEY `idx_apa_num` (`APA_NUM`),
  ADD KEY `idx_apa_uid` (`APA_UID`),
  ADD KEY `idx_apa_pripal` (`APA_PRIPAL`),
  ADD KEY `idx_apa_mvm` (`APA_MVM`);

--
-- Índices de tabela `s_pap`
--
ALTER TABLE `s_pap`
  ADD KEY `idx_pap_composite` (`PAP_UID`,`PAP_CMP`,`PAP_NUM`),
  ADD KEY `idx_pap_num` (`PAP_NUM`),
  ADD KEY `idx_pap_uid` (`PAP_UID`),
  ADD KEY `idx_pap_pa` (`PAP_PA`),
  ADD KEY `idx_pap_cbo` (`PAP_CBO`),
  ADD KEY `idx_pap_mvm` (`PAP_MVM`);

--
-- Índices de tabela `s_prd`
--
ALTER TABLE `s_prd`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_composite` (`prd_uid`,`prd_cmp`,`prd_flh`,`prd_seq`),
  ADD KEY `idx_prd_uid` (`prd_uid`),
  ADD KEY `idx_prd_cmp` (`prd_cmp`),
  ADD KEY `idx_prd_pa` (`prd_pa`),
  ADD KEY `idx_prd_cbo` (`prd_cbo`),
  ADD KEY `idx_grupo` (`grupo`),
  ADD KEY `idx_subgrupo` (`subgrupo`),
  ADD KEY `idx_forma` (`forma`);

--
-- Índices de tabela `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `users_username_unique` (`username`),
  ADD UNIQUE KEY `users_email_unique` (`email`),
  ADD KEY `users_username_index` (`username`),
  ADD KEY `users_role_index` (`role`),
  ADD KEY `users_active_index` (`active`);

--
-- AUTO_INCREMENT para tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `cismetro`
--
ALTER TABLE `cismetro`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `failed_jobs`
--
ALTER TABLE `failed_jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `forma`
--
ALTER TABLE `forma`
  MODIFY `id_registro` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `jobs`
--
ALTER TABLE `jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `s_prd`
--
ALTER TABLE `s_prd`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
