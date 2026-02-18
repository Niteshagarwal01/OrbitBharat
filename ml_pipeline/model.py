# Spacegen ML Pipeline - CME Detection
# ISRO-Level Implementation
# Developer: Nitesh Agarwal (2026)
# 
# Ensemble Model: Bi-LSTM + Transformer for CME Detection
# Uses real DSCOVR/ACE satellite data from L1

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from typing import Tuple, Optional, Dict
import math


class PositionalEncoding(nn.Module):
    """Positional encoding for Transformer"""
    def __init__(self, d_model: int, max_len: int = 5000, dropout: float = 0.1):
        super().__init__()
        self.dropout = nn.Dropout(p=dropout)
        
        position = torch.arange(max_len).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2) * (-math.log(10000.0) / d_model))
        pe = torch.zeros(max_len, 1, d_model)
        pe[:, 0, 0::2] = torch.sin(position * div_term)
        pe[:, 0, 1::2] = torch.cos(position * div_term)
        self.register_buffer('pe', pe)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.pe[:x.size(0)]
        return self.dropout(x)


class MultiHeadAttention(nn.Module):
    """Multi-head self-attention for temporal patterns"""
    def __init__(self, d_model: int, n_heads: int = 8, dropout: float = 0.1):
        super().__init__()
        assert d_model % n_heads == 0
        
        self.d_k = d_model // n_heads
        self.n_heads = n_heads
        
        self.w_q = nn.Linear(d_model, d_model)
        self.w_k = nn.Linear(d_model, d_model)
        self.w_v = nn.Linear(d_model, d_model)
        self.w_o = nn.Linear(d_model, d_model)
        self.dropout = nn.Dropout(dropout)
    
    def forward(self, x: torch.Tensor, mask: Optional[torch.Tensor] = None) -> Tuple[torch.Tensor, torch.Tensor]:
        batch_size, seq_len, _ = x.shape
        
        Q = self.w_q(x).view(batch_size, seq_len, self.n_heads, self.d_k).transpose(1, 2)
        K = self.w_k(x).view(batch_size, seq_len, self.n_heads, self.d_k).transpose(1, 2)
        V = self.w_v(x).view(batch_size, seq_len, self.n_heads, self.d_k).transpose(1, 2)
        
        scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(self.d_k)
        
        if mask is not None:
            scores = scores.masked_fill(mask == 0, -1e9)
        
        attn_weights = F.softmax(scores, dim=-1)
        attn_weights = self.dropout(attn_weights)
        
        attn_output = torch.matmul(attn_weights, V)
        attn_output = attn_output.transpose(1, 2).contiguous().view(batch_size, seq_len, -1)
        
        return self.w_o(attn_output), attn_weights


class TransformerEncoder(nn.Module):
    """Transformer encoder for global context"""
    def __init__(self, d_model: int = 128, n_heads: int = 8, n_layers: int = 4, 
                 d_ff: int = 512, dropout: float = 0.1):
        super().__init__()
        
        self.layers = nn.ModuleList([
            nn.TransformerEncoderLayer(
                d_model=d_model,
                nhead=n_heads,
                dim_feedforward=d_ff,
                dropout=dropout,
                batch_first=True
            ) for _ in range(n_layers)
        ])
        self.norm = nn.LayerNorm(d_model)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        for layer in self.layers:
            x = layer(x)
        return self.norm(x)


class BiLSTMWithAttention(nn.Module):
    """Bidirectional LSTM with self-attention for temporal sequences"""
    def __init__(self, input_size: int, hidden_size: int = 128, 
                 num_layers: int = 3, dropout: float = 0.3):
        super().__init__()
        
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=True,
            dropout=dropout if num_layers > 1 else 0
        )
        
        # Attention over LSTM outputs
        self.attention = MultiHeadAttention(hidden_size * 2, n_heads=4, dropout=dropout)
        self.layer_norm = nn.LayerNorm(hidden_size * 2)
    
    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        lstm_out, _ = self.lstm(x)
        attn_out, attn_weights = self.attention(lstm_out)
        output = self.layer_norm(lstm_out + attn_out)  # Residual connection
        return output, attn_weights


class CMEEnsembleModel(nn.Module):
    """
    Ensemble CME Detection Model
    
    Combines:
    1. Bi-LSTM with Attention (temporal patterns)
    2. Transformer Encoder (global context)
    
    Input Features:
    - Solar wind speed (km/s)
    - Proton density (p/cm³)
    - Temperature (K)
    - IMF Bz component (nT)
    - IMF magnitude (nT)
    - Plasma beta
    
    Output:
    - CME probability (0-1)
    - Predicted arrival time offset (hours)
    - Confidence score (0-1)
    """
    
    def __init__(self, 
                 input_size: int = 6,
                 hidden_size: int = 128,
                 lstm_layers: int = 3,
                 transformer_layers: int = 4,
                 n_heads: int = 8,
                 dropout: float = 0.3):
        super().__init__()
        
        self.input_size = input_size
        self.hidden_size = hidden_size
        
        # Input projection
        self.input_proj = nn.Linear(input_size, hidden_size)
        
        # Branch 1: Bi-LSTM with Attention
        self.lstm_branch = BiLSTMWithAttention(
            input_size=hidden_size,
            hidden_size=hidden_size,
            num_layers=lstm_layers,
            dropout=dropout
        )
        
        # Branch 2: Transformer Encoder
        self.pos_encoder = PositionalEncoding(hidden_size, dropout=dropout)
        self.transformer_branch = TransformerEncoder(
            d_model=hidden_size,
            n_heads=n_heads,
            n_layers=transformer_layers,
            dropout=dropout
        )
        
        # Ensemble fusion
        # LSTM outputs 2*hidden_size (bidirectional), Transformer outputs hidden_size
        fusion_size = hidden_size * 2 + hidden_size
        
        self.fusion = nn.Sequential(
            nn.Linear(fusion_size, hidden_size),
            nn.LayerNorm(hidden_size),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size, hidden_size // 2),
            nn.LayerNorm(hidden_size // 2),
            nn.GELU(),
            nn.Dropout(dropout)
        )
        
        # Output heads
        self.cme_probability = nn.Sequential(
            nn.Linear(hidden_size // 2, 1),
            nn.Sigmoid()
        )
        
        self.arrival_time = nn.Sequential(
            nn.Linear(hidden_size // 2, 1),
            nn.ReLU()  # Hours offset, must be positive
        )
        
        self.confidence = nn.Sequential(
            nn.Linear(hidden_size // 2, 1),
            nn.Sigmoid()
        )
        
        # Initialize weights
        self._init_weights()
    
    def _init_weights(self):
        """Xavier/Kaiming initialization"""
        for module in self.modules():
            if isinstance(module, nn.Linear):
                nn.init.kaiming_normal_(module.weight, mode='fan_in', nonlinearity='relu')
                if module.bias is not None:
                    nn.init.zeros_(module.bias)
            elif isinstance(module, nn.LSTM):
                for name, param in module.named_parameters():
                    if 'weight' in name:
                        nn.init.orthogonal_(param)
                    elif 'bias' in name:
                        nn.init.zeros_(param)
    
    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        Forward pass
        
        Args:
            x: Input tensor of shape (batch, seq_len, input_size)
               Expected features: [speed, density, temp, bz, bt, beta]
        
        Returns:
            Dictionary with:
            - cme_probability: Probability of CME (0-1)
            - arrival_time: Predicted arrival hours
            - confidence: Model confidence (0-1)
            - attention_weights: Attention visualization
        """
        batch_size, seq_len, _ = x.shape
        
        # Input projection
        x_proj = self.input_proj(x)
        
        # Branch 1: LSTM
        lstm_out, attn_weights = self.lstm_branch(x_proj)
        lstm_pooled = lstm_out.mean(dim=1)  # Global average pooling
        
        # Branch 2: Transformer
        x_pos = self.pos_encoder(x_proj.transpose(0, 1)).transpose(0, 1)
        transformer_out = self.transformer_branch(x_pos)
        transformer_pooled = transformer_out.mean(dim=1)
        
        # Ensemble fusion
        fused = torch.cat([lstm_pooled, transformer_pooled], dim=-1)
        features = self.fusion(fused)
        
        # Output predictions
        cme_prob = self.cme_probability(features).squeeze(-1)
        arrival = self.arrival_time(features).squeeze(-1) * 72  # Scale to 0-72 hours
        conf = self.confidence(features).squeeze(-1)
        
        return {
            'cme_probability': cme_prob,
            'arrival_time_hours': arrival,
            'confidence': conf,
            'attention_weights': attn_weights
        }
    
    def predict(self, x: torch.Tensor) -> Dict[str, float]:
        """Single prediction with numpy input"""
        self.eval()
        with torch.no_grad():
            if isinstance(x, np.ndarray):
                x = torch.FloatTensor(x)
            if x.dim() == 2:
                x = x.unsqueeze(0)
            
            output = self.forward(x)
            
            return {
                'cme_probability': output['cme_probability'].item(),
                'arrival_time_hours': output['arrival_time_hours'].item(),
                'confidence': output['confidence'].item()
            }


# Model configuration for different use cases
MODEL_CONFIGS = {
    'small': {
        'hidden_size': 64,
        'lstm_layers': 2,
        'transformer_layers': 2,
        'n_heads': 4
    },
    'medium': {
        'hidden_size': 128,
        'lstm_layers': 3,
        'transformer_layers': 4,
        'n_heads': 8
    },
    'large': {
        'hidden_size': 256,
        'lstm_layers': 4,
        'transformer_layers': 6,
        'n_heads': 8
    }
}


def create_model(config: str = 'medium', input_size: int = 6) -> CMEEnsembleModel:
    """Factory function to create model with preset configuration"""
    cfg = MODEL_CONFIGS.get(config, MODEL_CONFIGS['medium'])
    return CMEEnsembleModel(input_size=input_size, **cfg)


# Testing
if __name__ == '__main__':
    print("=" * 60)
    print("CME Ensemble Model - Architecture Test")
    print("=" * 60)
    
    # Create model
    model = create_model('medium')
    
    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    
    print(f"\nModel Configuration: medium")
    print(f"Total Parameters: {total_params:,}")
    print(f"Trainable Parameters: {trainable_params:,}")
    
    # Test forward pass
    batch_size = 4
    seq_len = 60  # 1 hour of 1-minute data
    input_size = 6
    
    dummy_input = torch.randn(batch_size, seq_len, input_size)
    
    print(f"\nInput shape: {dummy_input.shape}")
    
    output = model(dummy_input)
    
    print(f"\nOutputs:")
    print(f"  CME Probability: {output['cme_probability'].shape} -> values: {output['cme_probability'].detach().numpy()}")
    print(f"  Arrival Time (hours): {output['arrival_time_hours'].shape}")
    print(f"  Confidence: {output['confidence'].shape}")
    print(f"  Attention Weights: {output['attention_weights'].shape}")
    
    print("\n✅ Model architecture test passed!")
