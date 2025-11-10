import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ClaimsService } from '../_services/claims.service';

interface ValidationResult {
  name: string;
  status: 'passed' | 'review' | 'mismatch';
  confidence: number;
}

interface PolicyDetails {
  name: string;
  vehicleRegNo: string;
  policyStart: string;
  policyExpiry: string;
}

export interface Claim {
  id: string;
  claim_number?: string;
  description?: string;
  status: 'created' | 'documents_uploaded' | 'images_uploaded' | 'validating' | 'completed' | 'draft';
  createdAt: string;
  documents?: any[];
  images?: any[];
  validationResults?: ValidationResult[];
  policyDetails?: PolicyDetails;
  overallConfidence?: number;
  manualReviewRequired?: number;
}

@Component({
  selector: 'app-claims-list',
  templateUrl: './claims-list.component.html',
  styleUrls: ['./claims-list.component.scss']
})
export class ClaimsListComponent implements OnInit {
  claims: Claim[] = [];
  isLoading: boolean = false;

  constructor(
    private router: Router,
    private claimsService: ClaimsService
  ) { }

  ngOnInit(): void {
    this.loadClaims();
  }

  // GET /api/v1/claims/ - Get All Claims
  loadClaims(skip: number = 0, limit: number = 10): void {
    this.isLoading = true;
    
    this.claimsService.getAllClaims(skip, limit).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Backend returns { claims: [], total: number } structure
          const claimsData = response.data as any;
          const claimsArray = claimsData.claims || (Array.isArray(claimsData) ? claimsData : []);
          
          // Map backend format to component format
          this.claims = claimsArray.map((claim: any) => ({
            id: claim._id || claim.id,
            claim_number: claim.claim_number,
            description: claim.description,
            status: claim.status || 'created',
            createdAt: claim.CreatedOn || claim.createdAt || claim.CreatedOn,
            documents: claim.documents || [],
            images: claim.images || [],
            validationResults: claim.validationResults,
            policyDetails: claim.policyDetails,
            overallConfidence: claim.overallConfidence,
            manualReviewRequired: claim.manualReviewRequired
          }));
        } else {
          console.error('Failed to load claims:', response.error);
          this.claims = [];
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading claims:', error);
        this.claims = [];
        this.isLoading = false;
      }
    });
  }

  createNewClaim(): void {
    this.router.navigate(['/claim-validator']);
  }

  viewClaim(claimId: string): void {
    // Navigate to the validate step to show results
    this.router.navigate(['/claim-validator', claimId, 'validate']);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'completed':
        return 'status-completed';
      case 'validating':
        return 'status-validating';
      case 'images_uploaded':
        return 'status-uploaded';
      case 'documents_uploaded':
        return 'status-uploaded';
      case 'created':
      case 'draft':
        return 'status-created';
      default:
        return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'validating':
        return 'Validating';
      case 'images_uploaded':
        return 'Images Uploaded';
      case 'documents_uploaded':
        return 'Documents Uploaded';
      case 'created':
        return 'Created';
      case 'draft':
        return 'Draft';
      default:
        return status;
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

