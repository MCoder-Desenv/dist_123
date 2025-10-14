// /api/admin/products/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, getCompanyFilter } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadFile, deleteFile, renameFile } from '@/lib/storage';
import path from 'path';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

// PUT /api/admin/products/[id] - Atualizar produto
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.company_id) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const productId = params.id;

    const existingProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        ...getCompanyFilter(session),
      },
      include: { variants: true },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado' },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string | null;
    const category_id = formData.get('category_id') as string;
    const sku = formData.get('sku') as string | null;
    const base_price = parseFloat(formData.get('base_price') as string);
    const active = formData.get('active') === 'true';
    const imageFile = formData.get('image') as File | null;
    const variantsJson = formData.get('variants') as string | null;
    const removeImage = formData.get('remove_image') === 'true';

    let image_url = existingProduct.image_url;

    // Remover imagem antiga se solicitado
    if (removeImage && image_url) {
      try {
        await deleteFile(image_url);
        image_url = null;
      } catch (e) {
        console.error('Error deleting old image:', e);
      }
    }

    // Upload da nova imagem se fornecida
    if (imageFile) {
      // Deletar imagem antiga se existir
      if (image_url) {
        try {
          await deleteFile(image_url);
        } catch (e) {
          console.error('Error deleting old image:', e);
        }
      }

      const buffer = Buffer.from(await imageFile.arrayBuffer());
      await sharp(buffer).metadata(); // valida imagem
      const ext = path.extname(imageFile.name) || '.jpg';
      const tempKey = `products/temp/${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
      await uploadFile(buffer, tempKey);
      image_url = tempKey; // será movido ao final
    }

    // Atualizar produto
    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        name,
        description,
        category_id,
        sku,
        base_price,
        image_url,
        active,
      },
    });

    // Mover imagem temporária para pasta final
    if (image_url && image_url.startsWith('products/temp/')) {
      const ext = path.extname(image_url);
      const finalKey = `products/${product.id}/image${ext}`;
      await renameFile(image_url, finalKey);
      await prisma.product.update({
        where: { id: product.id },
        data: { image_url: finalKey },
      });
    }

    // Atualizar variações se fornecidas
    if (variantsJson) {
      const variants = JSON.parse(variantsJson);

      // Deletar variações antigas
      await prisma.productVariant.deleteMany({
        where: { product_id: productId },
      });

      // Criar novas variações
      if (Array.isArray(variants) && variants.length > 0) {
        const variantData = await Promise.all(
          variants.map(async (v: any) => {
            let imageUrl = v.image_url || null;
            if (imageUrl && imageUrl.startsWith('products/temp/')) {
              const ext = path.extname(imageUrl) || '.jpg';
              const finalKey = `products/${product.id}/variants/${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
              await renameFile(imageUrl, finalKey);
              imageUrl = finalKey;
            }
            return {
              product_id: productId,
              name: v.name,
              volume: v.volume || null,
              unit_type: v.unit_type || null,
              price_modifier: v.price_modifier || 0,
              stock_quantity: v.stock_quantity || 0,
              image_url: imageUrl,
              active: v.active !== false,
            };
          })
        );

        await prisma.productVariant.createMany({
          data: variantData,
        });
      }
    }

    // Buscar produto completo com variações
    const fullProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        variants: true,
      },
    });

    return NextResponse.json({ success: true, data: fullProduct });
  } catch (error) {
    console.error('Products PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar produto' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/products/[id] - Deletar produto
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.company_id) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const productId = params.id;

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        ...getCompanyFilter(session),
      },
      include: { variants: true },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado' },
        { status: 404 }
      );
    }

    // Deletar imagem principal
    if (product.image_url) {
      try {
        await deleteFile(product.image_url);
      } catch (e) {
        console.error('Error deleting image:', e);
      }
    }

    // Deletar imagens das variações
    for (const variant of product.variants) {
      if (variant.image_url) {
        try {
          await deleteFile(variant.image_url);
        } catch (e) {
          console.error('Error deleting variant image:', e);
        }
      }
    }

    // Deletar produto (variações são deletadas em cascata)
    await prisma.product.delete({
      where: { id: productId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Products DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao deletar produto' },
      { status: 500 }
    );
  }
}